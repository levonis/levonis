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

    // Get listing
    const { data: listing } = await supabase
      .from("gacha_marketplace")
      .select("*, gacha_dolls(*)")
      .eq("id", listing_id)
      .eq("status", "active")
      .single();

    if (!listing) {
      return new Response(JSON.stringify({ error: "Listing not found or sold" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (listing.seller_id === user.id) {
      return new Response(JSON.stringify({ error: "Cannot buy your own listing" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check buyer points
    const { data: buyerPts } = await supabase
      .from("user_points").select("available_points").eq("user_id", user.id).single();
    
    const buyerPoints = buyerPts?.available_points ?? 0;
    if (buyerPoints < listing.asking_price) {
      return new Response(JSON.stringify({ error: "Not enough points", required: listing.asking_price, available: buyerPoints }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get fee
    const { data: feeSetting } = await supabase
      .from("gacha_settings").select("value").eq("key", "marketplace_fee_percent").single();
    const feePercent = Number(feeSetting?.value ?? 5);
    const fee = Math.round(listing.asking_price * feePercent / 100);
    const sellerReceives = listing.asking_price - fee;

    // Deduct buyer points
    await supabase
      .from("user_points")
      .update({ available_points: buyerPoints - listing.asking_price })
      .eq("user_id", user.id);

    // Add seller points
    const { data: sellerPts } = await supabase
      .from("user_points").select("available_points").eq("user_id", listing.seller_id).single();
    if (sellerPts) {
      await supabase
        .from("user_points")
        .update({ available_points: sellerPts.available_points + sellerReceives })
        .eq("user_id", listing.seller_id);
    }

    // Transfer inventory: update existing item to buyer
    await supabase
      .from("gacha_user_inventory")
      .update({ user_id: user.id, is_listed: false, acquired_from: "marketplace", acquired_price: listing.asking_price })
      .eq("id", listing.inventory_item_id);

    // Mark listing as sold
    await supabase
      .from("gacha_marketplace")
      .update({ status: "sold", buyer_id: user.id, sold_at: new Date().toISOString() })
      .eq("id", listing_id);

    // Update doll demand
    const doll = listing.gacha_dolls;
    if (doll) {
      await supabase
        .from("gacha_dolls")
        .update({ demand_score: (doll.demand_score ?? 0) + 1 })
        .eq("id", doll.id);
    }

    // Record transactions
    await supabase.from("gacha_transactions").insert([
      {
        user_id: user.id,
        transaction_type: "market_buy",
        amount: -listing.asking_price,
        reference_type: "listing",
        reference_id: listing_id,
        counterparty_id: listing.seller_id,
        description: `Bought: ${doll?.name}`,
        description_ar: `شراء: ${doll?.name_ar}`,
      },
      {
        user_id: listing.seller_id,
        transaction_type: "market_sell",
        amount: sellerReceives,
        reference_type: "listing",
        reference_id: listing_id,
        counterparty_id: user.id,
        description: `Sold: ${doll?.name} (fee: ${fee})`,
        description_ar: `بيع: ${doll?.name_ar} (رسوم: ${fee})`,
      },
    ]);

    // Price history snapshot
    await supabase.from("gacha_price_history").insert({
      doll_id: listing.doll_id,
      price: listing.asking_price,
      demand_score: doll?.demand_score,
      supply_count: doll?.supply_count,
    });

    return new Response(JSON.stringify({
      success: true,
      price_paid: listing.asking_price,
      fee,
      remaining_points: buyerPoints - listing.asking_price,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("Gacha market buy error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
