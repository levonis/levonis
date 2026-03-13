import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonRes(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonRes({ error: "Missing auth" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return jsonRes({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);

    // Parse spin count from body (default 1, max 10)
    let spinCount = 1;
    try {
      const body = await req.json();
      spinCount = Math.min(10, Math.max(1, Math.floor(Number(body?.count) || 1)));
    } catch { /* default 1 */ }

    // Get game settings
    const { data: settings } = await admin
      .from("mystery_case_settings")
      .select("*")
      .limit(1)
      .single();

    if (!settings || !settings.game_enabled) {
      return jsonRes({ error: "اللعبة غير متاحة حالياً" }, 400);
    }

    const ticketsPerSpin = settings.tickets_per_spin || 4;
    const totalTicketsNeeded = ticketsPerSpin * spinCount;

    // Check cooldown (only for first spin)
    if (settings.spin_cooldown_seconds > 0) {
      const { data: lastSpin } = await admin
        .from("mystery_case_spins")
        .select("created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (lastSpin) {
        const elapsed = (Date.now() - new Date(lastSpin.created_at).getTime()) / 1000;
        if (elapsed < settings.spin_cooldown_seconds) {
          const remaining = Math.ceil(settings.spin_cooldown_seconds - elapsed);
          return jsonRes({ error: `انتظر ${remaining} ثانية قبل اللف مرة أخرى` }, 429);
        }
      }
    }

    // Check user ticket balance
    const { data: ticketData } = await admin
      .from("user_tickets")
      .select("ticket_count")
      .eq("user_id", user.id)
      .single();

    const currentTickets = ticketData?.ticket_count || 0;
    if (currentTickets < totalTicketsNeeded) {
      // Calculate how many spins they can actually afford
      const affordableSpins = Math.floor(currentTickets / ticketsPerSpin);
      if (affordableSpins < 1) {
        return jsonRes({ error: "لا تملك تذاكر كافية", needed: totalTicketsNeeded, current: currentTickets }, 400);
      }
      // Reduce spin count to what they can afford
      spinCount = affordableSpins;
    }

    const actualTotalTickets = ticketsPerSpin * spinCount;

    // Get active rewards
    const { data: rewards } = await admin
      .from("mystery_case_rewards")
      .select("*")
      .eq("is_active", true)
      .eq("display_only", false)
      .gt("drop_chance", 0);

    if (!rewards || rewards.length === 0) {
      return jsonRes({ error: "لا توجد جوائز متاحة" }, 400);
    }

    const totalWeight = rewards.reduce((sum: number, r: any) => sum + Number(r.drop_chance), 0);

    // Deduct all tickets at once
    const { data: deductResult } = await admin.rpc("deduct_user_tickets", {
      p_user_id: user.id,
      p_amount: actualTotalTickets,
    });

    if (!deductResult) {
      return jsonRes({ error: "فشل خصم التذاكر" }, 400);
    }

    // Perform all spins
    const results: any[] = [];
    let ticketsToRefund = 0;

    for (let i = 0; i < spinCount; i++) {
      // Weighted random selection
      let rand = Math.random() * totalWeight;
      let winner = rewards[0];
      for (const reward of rewards) {
        rand -= Number(reward.drop_chance);
        if (rand <= 0) { winner = reward; break; }
      }

      const snapshot = {
        name_ar: winner.name_ar,
        image_url: winner.image_url,
        rarity: winner.rarity,
        reward_type: winner.reward_type,
        ticket_reward_amount: winner.ticket_reward_amount,
        product_id: winner.product_id,
      };

      const { data: spin, error: spinError } = await admin
        .from("mystery_case_spins")
        .insert({
          user_id: user.id,
          reward_id: winner.id,
          reward_snapshot: snapshot,
          tickets_spent: ticketsPerSpin,
        })
        .select()
        .single();

      if (spinError) {
        ticketsToRefund += ticketsPerSpin;
        continue;
      }

      // Auto-grant ticket rewards
      if (winner.reward_type === "tickets" && winner.ticket_reward_amount > 0) {
        await admin.rpc("add_user_tickets", {
          p_user_id: user.id,
          p_amount: winner.ticket_reward_amount,
          p_source: "mystery_case_win",
        });
        await admin.from("mystery_case_spins").update({ is_claimed: true, claimed_at: new Date().toISOString() }).eq("id", spin.id);
      }

      // Product/custom rewards → competition_prizes
      if (winner.reward_type === "product" || winner.reward_type === "custom") {
        await admin.from("competition_prizes").insert({
          user_id: user.id,
          prize_name_ar: winner.name_ar,
          prize_image_url: winner.image_url,
          prize_type: winner.reward_type === "product" ? "product" : "custom",
          product_id: winner.product_id || null,
          source_type: "mystery_case",
          status: "pending",
        });
        await admin.from("mystery_case_spins").update({ is_claimed: true, claimed_at: new Date().toISOString() }).eq("id", spin.id);
      }

      results.push({
        spin_id: spin.id,
        reward: { id: winner.id, ...snapshot },
      });
    }

    // Refund failed spins
    if (ticketsToRefund > 0) {
      await admin.rpc("add_user_tickets", {
        p_user_id: user.id,
        p_amount: ticketsToRefund,
        p_source: "mystery_case_refund",
      });
    }

    if (results.length === 0) {
      return jsonRes({ error: "فشل حفظ النتائج" }, 500);
    }

    return jsonRes({
      success: true,
      count: results.length,
      total_tickets_spent: ticketsPerSpin * results.length,
      // For backward compat: first result as "reward"
      spin_id: results[0].spin_id,
      reward: results[0].reward,
      // All results
      results,
    });
  } catch (err) {
    return jsonRes({ error: "Server error", details: String(err) }, 500);
  }
});
