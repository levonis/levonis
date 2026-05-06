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

    const { inventory_item_id, sell_type } = await req.json();
    // sell_type: "instant" or "list" (with asking_price)
    
    if (!inventory_item_id) {
      return new Response(JSON.stringify({ error: "Missing inventory_item_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get inventory item
    const { data: item } = await supabase
      .from("gacha_user_inventory")
      .select("*, gacha_dolls(*)")
      .eq("id", inventory_item_id)
      .eq("user_id", user.id)
      .eq("is_listed", false)
      .single();

    if (!item) {
      return new Response(JSON.stringify({ error: "Item not found or already listed" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!item.gacha_dolls?.is_tradable) {
      return new Response(JSON.stringify({ error: "This doll is not tradable" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (sell_type === "instant") {
      // Get instant sell settings
      const { data: minDiscSetting } = await supabase
        .from("gacha_settings").select("value").eq("key", "instant_sell_min_discount").single();
      const { data: maxDiscSetting } = await supabase
        .from("gacha_settings").select("value").eq("key", "instant_sell_max_discount").single();

      const minDiscount = Number(minDiscSetting?.value ?? 10);
      const maxDiscount = Number(maxDiscSetting?.value ?? 50);
      
      // Calculate discount based on demand
      const demand = item.gacha_dolls.demand_score ?? 0;
      // Higher demand = lower discount
      const discountRange = maxDiscount - minDiscount;
      const demandFactor = Math.min(demand / 100, 1); // normalize to 0-1
      const discount = maxDiscount - (demandFactor * discountRange);
      
      const marketPrice = item.gacha_dolls.current_price;
      const sellPrice = Math.max(1, Math.round(marketPrice * (1 - discount / 100)));

      // Atomic points award (race-free)
      await supabase.rpc("add_user_points", {
        p_user_id: user.id,
        p_amount: sellPrice,
        p_source: "gacha_sell",
      });

      // Remove from inventory
      await supabase.from("gacha_user_inventory").delete().eq("id", inventory_item_id);

      // Update doll supply
      await supabase
        .from("gacha_dolls")
        .update({ supply_count: Math.max(0, (item.gacha_dolls.supply_count ?? 1) - 1) })
        .eq("id", item.doll_id);

      // Record transaction
      await supabase.from("gacha_transactions").insert({
        user_id: user.id,
        transaction_type: "instant_sell",
        amount: sellPrice,
        reference_type: "doll",
        reference_id: item.doll_id,
        description: `Instant sell: ${item.gacha_dolls.name}`,
        description_ar: `بيع فوري: ${item.gacha_dolls.name_ar}`,
      });

      return new Response(JSON.stringify({
        success: true,
        sell_price: sellPrice,
        market_price: marketPrice,
        discount_percent: Math.round(discount),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // List for marketplace
    const { asking_price } = await req.json().catch(() => ({ asking_price: null }));
    
    // Mark as listed
    await supabase
      .from("gacha_user_inventory")
      .update({ is_listed: true })
      .eq("id", inventory_item_id);

    // Create marketplace listing
    const { data: listing } = await supabase.from("gacha_marketplace").insert({
      seller_id: user.id,
      inventory_item_id: inventory_item_id,
      doll_id: item.doll_id,
      asking_price: asking_price || item.gacha_dolls.current_price,
      status: "active",
    }).select().single();

    return new Response(JSON.stringify({
      success: true,
      listing,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("Gacha sell error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
