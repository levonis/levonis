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
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!).auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { listing_id } = await req.json();
    if (!listing_id) {
      return new Response(JSON.stringify({ error: "Missing listing_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Atomic purchase via SECURITY DEFINER RPC (row locks + transactional)
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: rpcRes, error: rpcErr } = await userClient.rpc("gacha_market_buy_atomic", {
      p_listing_id: listing_id,
    });

    if (rpcErr || !rpcRes) {
      console.error("gacha_market_buy_atomic error:", rpcErr);
      return new Response(JSON.stringify({ error: "Purchase failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = rpcRes as Record<string, unknown>;
    if (!result.success) {
      const errKey = String(result.error || "error");
      const map: Record<string, [number, string]> = {
        unauthorized: [401, "Unauthorized"],
        listing_not_found: [404, "Listing not found or sold"],
        cannot_buy_own: [400, "Cannot buy your own listing"],
        insufficient_points: [400, "Not enough points"],
      };
      const [status, msg] = map[errKey] ?? [400, errKey];
      return new Response(JSON.stringify({ error: msg, ...result }), {
        status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Side-effects (non-atomic but safe): get listing/doll for record keeping
    const { data: listing } = await supabase
      .from("gacha_marketplace")
      .select("*, gacha_dolls(*)")
      .eq("id", listing_id)
      .single();
    const doll = listing?.gacha_dolls;
    const sellerId = result.seller_id as string;
    const fee = Number(result.fee || 0);
    const sellerReceives = Number(result.seller_receives || 0);

    if (doll) {
      await supabase.from("gacha_dolls")
        .update({ demand_score: (doll.demand_score ?? 0) + 1 })
        .eq("id", doll.id);
    }

    await supabase.from("gacha_transactions").insert([
      {
        user_id: user.id,
        transaction_type: "market_buy",
        amount: -Number(result.price_paid || 0),
        reference_type: "listing",
        reference_id: listing_id,
        counterparty_id: sellerId,
        description: `Bought: ${doll?.name}`,
        description_ar: `شراء: ${doll?.name_ar}`,
      },
      {
        user_id: sellerId,
        transaction_type: "market_sell",
        amount: sellerReceives,
        reference_type: "listing",
        reference_id: listing_id,
        counterparty_id: user.id,
        description: `Sold: ${doll?.name} (fee: ${fee})`,
        description_ar: `بيع: ${doll?.name_ar} (رسوم: ${fee})`,
      },
    ]);

    if (doll) {
      await supabase.from("gacha_price_history").insert({
        doll_id: doll.id,
        price: Number(result.price_paid || 0),
        demand_score: doll.demand_score,
        supply_count: doll.supply_count,
      });
    }

    return new Response(JSON.stringify({
      success: true,
      price_paid: Number(result.price_paid || 0),
      fee,
      remaining_points: Number(result.remaining_points || 0),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });


  } catch (err) {
    console.error("Gacha market buy error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
