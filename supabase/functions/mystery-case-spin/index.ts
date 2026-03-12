import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // User client to get user
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service role client for mutations
    const admin = createClient(supabaseUrl, serviceKey);

    // Get game settings
    const { data: settings } = await admin
      .from("mystery_case_settings")
      .select("*")
      .limit(1)
      .single();

    if (!settings || !settings.game_enabled) {
      return new Response(JSON.stringify({ error: "اللعبة غير متاحة حالياً" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ticketsNeeded = settings.tickets_per_spin || 4;

    // Check cooldown
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
          return new Response(
            JSON.stringify({ error: `انتظر ${remaining} ثانية قبل اللف مرة أخرى` }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
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
    if (currentTickets < ticketsNeeded) {
      return new Response(
        JSON.stringify({ error: "لا تملك تذاكر كافية", needed: ticketsNeeded, current: currentTickets }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get active rewards (non-display-only for actual winning)
    const { data: rewards } = await admin
      .from("mystery_case_rewards")
      .select("*")
      .eq("is_active", true)
      .eq("display_only", false)
      .gt("drop_chance", 0);

    if (!rewards || rewards.length === 0) {
      return new Response(JSON.stringify({ error: "لا توجد جوائز متاحة" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Weighted random selection
    const totalWeight = rewards.reduce((sum: number, r: any) => sum + Number(r.drop_chance), 0);
    let rand = Math.random() * totalWeight;
    let winner = rewards[0];
    for (const reward of rewards) {
      rand -= Number(reward.drop_chance);
      if (rand <= 0) {
        winner = reward;
        break;
      }
    }

    // Deduct tickets
    const { data: deductResult } = await admin.rpc("deduct_user_tickets", {
      p_user_id: user.id,
      p_amount: ticketsNeeded,
    });

    if (!deductResult) {
      return new Response(JSON.stringify({ error: "فشل خصم التذاكر" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save spin record
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
        tickets_spent: ticketsNeeded,
      })
      .select()
      .single();

    if (spinError) {
      // Refund tickets on error
      await admin.rpc("add_user_tickets", {
        p_user_id: user.id,
        p_amount: ticketsNeeded,
        p_source: "mystery_case_refund",
      });
      return new Response(JSON.stringify({ error: "فشل حفظ النتيجة" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auto-grant ticket rewards
    if (winner.reward_type === "tickets" && winner.ticket_reward_amount > 0) {
      await admin.rpc("add_user_tickets", {
        p_user_id: user.id,
        p_amount: winner.ticket_reward_amount,
        p_source: "mystery_case_win",
      });
      // Auto-claim ticket rewards
      await admin
        .from("mystery_case_spins")
        .update({ is_claimed: true, claimed_at: new Date().toISOString() })
        .eq("id", spin.id);
    }

    // For product/custom rewards, save to competition_prizes for /offers page
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
      await admin
        .from("mystery_case_spins")
        .update({ is_claimed: true, claimed_at: new Date().toISOString() })
        .eq("id", spin.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        spin_id: spin.id,
        reward: {
          id: winner.id,
          ...snapshot,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: "Server error", details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
