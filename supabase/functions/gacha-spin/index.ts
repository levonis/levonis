import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Get user from JWT
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!).auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { machine_id, spin_count = 1 } = await req.json();
    
    if (!machine_id || typeof spin_count !== "number" || spin_count < 1 || spin_count > 10) {
      return new Response(JSON.stringify({ error: "Invalid parameters" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Get machine
    const { data: machine, error: machineErr } = await supabase
      .from("gacha_machines").select("*").eq("id", machine_id).eq("is_active", true).single();
    
    if (machineErr || !machine) {
      return new Response(JSON.stringify({ error: "Machine not found or inactive" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check time limits
    if (machine.is_limited) {
      const now = new Date();
      if (machine.available_from && new Date(machine.available_from) > now) {
        return new Response(JSON.stringify({ error: "Machine not available yet" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (machine.available_until && new Date(machine.available_until) < now) {
        return new Response(JSON.stringify({ error: "Machine no longer available" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const totalCost = machine.ticket_cost * spin_count;

    // 2. Atomically deduct tickets up-front (with row-level locking inside the RPC).
    // Prevents race conditions where concurrent spins double-spend the same balance.
    const { data: deductOk, error: deductErr } = await supabase.rpc("deduct_user_tickets", {
      p_user_id: user.id,
      p_amount: totalCost,
    });
    if (deductErr || !deductOk) {
      return new Response(JSON.stringify({ error: "Not enough tickets", required: totalCost }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Get prize pool
    const { data: prizes } = await supabase
      .from("gacha_machine_prizes")
      .select("*, gacha_rarity_tiers(*)")
      .eq("machine_id", machine_id)
      .eq("is_active", true);

    if (!prizes || prizes.length === 0) {
      return new Response(JSON.stringify({ error: "No prizes available" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Get guaranteed rules for this machine
    const { data: guaranteedRules } = await supabase
      .from("gacha_guaranteed_rules")
      .select("*")
      .eq("machine_id", machine_id)
      .eq("is_active", true)
      .order("priority_order", { ascending: true });

    // 5. Get user's spin stats for this machine (for guaranteed checks)
    const { data: userSpins } = await supabase
      .from("gacha_spins")
      .select("id, tickets_spent")
      .eq("user_id", user.id)
      .eq("machine_id", machine_id);

    const totalUserSpins = userSpins?.length ?? 0;
    const totalUserTicketsSpent = userSpins?.reduce((s, sp) => s + sp.tickets_spent, 0) ?? 0;

    // Get user's guaranteed claims
    const { data: userClaims } = await supabase
      .from("gacha_guaranteed_claims")
      .select("*")
      .eq("user_id", user.id)
      .eq("machine_id", machine_id);

    // 6. Spin logic - pick prizes
    const results: any[] = [];

    for (let i = 0; i < spin_count; i++) {
      const spinIndex = totalUserSpins + i;
      const spentSoFar = totalUserTicketsSpent + (machine.ticket_cost * (i + 1));

      // Check guaranteed rewards first
      let guaranteedPrize = null;
      if (guaranteedRules) {
        for (const rule of guaranteedRules) {
          // Check date range
          if (rule.start_date && new Date(rule.start_date) > new Date()) continue;
          if (rule.end_date && new Date(rule.end_date) < new Date()) continue;

          // Check per-user limit
          const existingClaim = userClaims?.find(c => c.rule_id === rule.id);
          if (existingClaim && rule.per_user_limit && existingClaim.claim_count >= rule.per_user_limit) continue;
          if (existingClaim && !rule.is_repeatable) continue;

          // Check condition
          let conditionMet = false;
          switch (rule.condition_type) {
            case "first_spin":
              conditionMet = spinIndex === 0;
              break;
            case "spin_count":
              conditionMet = (spinIndex + 1) === rule.condition_value;
              break;
            case "exact_spend":
              conditionMet = spentSoFar === rule.condition_value;
              break;
            case "spend_up_to":
              conditionMet = spentSoFar <= rule.condition_value;
              break;
            case "spend_at_least":
              conditionMet = spentSoFar >= rule.condition_value;
              break;
          }

          if (conditionMet) {
            guaranteedPrize = rule;
            break;
          }
        }
      }

      let selectedPrize;
      let isGuaranteed = false;

      if (guaranteedPrize) {
        isGuaranteed = true;
        // Find matching prize in pool or create virtual result
        const matchingPrize = prizes.find(p => p.id === guaranteedPrize.reward_ref_id);
        selectedPrize = matchingPrize || {
          id: null,
          prize_type: guaranteedPrize.reward_type,
          prize_name: guaranteedPrize.reward_name,
          prize_name_ar: guaranteedPrize.reward_name_ar,
          prize_image_url: guaranteedPrize.reward_image_url,
          rarity_tier_id: null,
          points_value: 0,
          gacha_rarity_tiers: null,
        };

        // Record claim
        if (existingClaimForRule(userClaims, guaranteedPrize.id)) {
          await supabase.rpc("increment_field", {} as any).then(() => {});
          // Just update claim count
          await supabase
            .from("gacha_guaranteed_claims")
            .update({ claim_count: (userClaims?.find(c => c.rule_id === guaranteedPrize.id)?.claim_count ?? 0) + 1 })
            .eq("user_id", user.id)
            .eq("rule_id", guaranteedPrize.id);
        } else {
          await supabase.from("gacha_guaranteed_claims").insert({
            user_id: user.id,
            rule_id: guaranteedPrize.id,
            machine_id: machine_id,
            claim_count: 1,
          });
        }
      } else {
        // Weighted random selection
        const availablePrizes = prizes.filter(p => !p.stock || p.stock > 0);
        if (availablePrizes.length === 0) {
          // Fallback to first prize
          selectedPrize = prizes[0];
        } else {
          const totalWeight = availablePrizes.reduce((s, p) => s + Number(p.drop_weight), 0);
          let random = Math.random() * totalWeight;
          selectedPrize = availablePrizes[0];
          for (const prize of availablePrizes) {
            random -= Number(prize.drop_weight);
            if (random <= 0) {
              selectedPrize = prize;
              break;
            }
          }
        }

        // Decrease stock if limited
        if (selectedPrize.stock !== null && selectedPrize.stock > 0) {
          await supabase
            .from("gacha_machine_prizes")
            .update({ stock: selectedPrize.stock - 1 })
            .eq("id", selectedPrize.id);
        }
      }

      // 7. Record spin
      const { data: spinRecord } = await supabase.from("gacha_spins").insert({
        user_id: user.id,
        machine_id: machine_id,
        prize_id: selectedPrize.id,
        prize_type: selectedPrize.prize_type,
        prize_name: selectedPrize.prize_name,
        prize_name_ar: selectedPrize.prize_name_ar,
        rarity_tier_id: selectedPrize.rarity_tier_id,
        tickets_spent: machine.ticket_cost,
        is_guaranteed: isGuaranteed,
        guaranteed_rule_id: isGuaranteed ? guaranteedPrize?.id : null,
      }).select().single();

      // 8. Award prize based on type
      if (selectedPrize.prize_type === "doll" && selectedPrize.prize_ref_id) {
        await supabase.from("gacha_user_inventory").insert({
          user_id: user.id,
          doll_id: selectedPrize.prize_ref_id,
          acquired_from: "spin",
          acquired_price: 0,
          spin_id: spinRecord?.id,
        });
        // Update supply count
        await supabase.rpc("increment_field", {} as any).catch(() => {});
      } else if (selectedPrize.prize_type === "coupon" && selectedPrize.prize_ref_id) {
        const { data: couponDef } = await supabase
          .from("gacha_coupons").select("validity_days").eq("id", selectedPrize.prize_ref_id).single();
        const expiresAt = couponDef?.validity_days
          ? new Date(Date.now() + couponDef.validity_days * 86400000).toISOString()
          : null;
        await supabase.from("gacha_user_coupons").insert({
          user_id: user.id,
          coupon_id: selectedPrize.prize_ref_id,
          expires_at: expiresAt,
          spin_id: spinRecord?.id,
        });
      } else if (selectedPrize.prize_type === "points" && selectedPrize.points_value) {
        // Add points to user
        const { data: pts } = await supabase
          .from("user_points").select("available_points").eq("user_id", user.id).single();
        if (pts) {
          await supabase
            .from("user_points")
            .update({ available_points: pts.available_points + selectedPrize.points_value })
            .eq("user_id", user.id);
        }
      }
      // advice cards don't need inventory tracking, just shown in result

      results.push({
        spin_id: spinRecord?.id,
        prize_type: selectedPrize.prize_type,
        prize_name: selectedPrize.prize_name,
        prize_name_ar: selectedPrize.prize_name_ar,
        prize_image_url: selectedPrize.prize_image_url,
        points_value: selectedPrize.points_value,
        rarity: selectedPrize.gacha_rarity_tiers ? {
          name: selectedPrize.gacha_rarity_tiers.name,
          name_ar: selectedPrize.gacha_rarity_tiers.name_ar,
          color: selectedPrize.gacha_rarity_tiers.color,
          glow_color: selectedPrize.gacha_rarity_tiers.glow_color,
        } : null,
        is_guaranteed: isGuaranteed,
      });
    }

    // 9. Tickets already deducted atomically at the top — fetch remaining for response.
    const { data: remainingTicketsData } = await supabase
      .from("user_tickets").select("ticket_count").eq("user_id", user.id).single();

    return new Response(JSON.stringify({
      success: true,
      results,
      tickets_spent: totalCost,
      remaining_tickets: remainingTicketsData?.ticket_count ?? 0,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Gacha spin error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function existingClaimForRule(claims: any[] | null, ruleId: string): boolean {
  return !!claims?.find(c => c.rule_id === ruleId);
}
