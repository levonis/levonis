import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MerchantApplication {
  id: string;
  user_id: string;
  badge_tier: string;
  badge_override: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get current year-month
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // Get all approved merchants who don't have badge_override enabled
    const { data: merchants, error: merchantsError } = await supabase
      .from("merchant_applications")
      .select("id, user_id, badge_tier, badge_override")
      .eq("status", "approved")
      .eq("badge_override", false);

    if (merchantsError) {
      throw new Error(`Failed to fetch merchants: ${merchantsError.message}`);
    }

    if (!merchants || merchants.length === 0) {
      return new Response(
        JSON.stringify({ message: "No merchants to update", updated: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 1: Count completed orders for each merchant in the current month
    // We count from print_offers where status = 'completed'
    const merchantIds = merchants.map((m: MerchantApplication) => m.user_id);
    
    // Get the start and end of current month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Count completed orders per merchant for current month
    const { data: orderCounts, error: orderError } = await supabase
      .from("print_offers")
      .select("trader_id, id")
      .in("trader_id", merchantIds)
      .eq("status", "completed")
      .gte("completed_at", startOfMonth.toISOString())
      .lte("completed_at", endOfMonth.toISOString());

    if (orderError) {
      console.error("Error fetching orders:", orderError);
    }

    // Aggregate order counts by merchant
    const countsByMerchant = new Map<string, number>();
    if (orderCounts) {
      for (const order of orderCounts) {
        const count = countsByMerchant.get(order.trader_id) || 0;
        countsByMerchant.set(order.trader_id, count + 1);
      }
    }

    // Step 2: Update monthly order records
    for (const [merchantId, count] of countsByMerchant.entries()) {
      await supabase
        .from("merchant_monthly_orders")
        .upsert({
          merchant_id: merchantId,
          year_month: currentMonth,
          completed_orders: count,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "merchant_id,year_month",
        });
    }

    // Step 3: Calculate new badge tiers for each merchant
    let updatedCount = 0;
    const updates: { merchantId: string; userId: string; oldTier: string; newTier: string }[] = [];

    for (const merchant of merchants as MerchantApplication[]) {
      // Call the database function to calculate badge tier
      const { data: tierResult, error: tierError } = await supabase
        .rpc("calculate_merchant_badge_tier", { p_merchant_id: merchant.user_id });

      if (tierError) {
        console.error(`Error calculating tier for ${merchant.user_id}:`, tierError);
        continue;
      }

      const newTier = tierResult || "none";
      
      // Only update if tier changed
      if (newTier !== merchant.badge_tier) {
        // Update merchant_applications
        const { error: updateAppError } = await supabase
          .from("merchant_applications")
          .update({ badge_tier: newTier })
          .eq("id", merchant.id);

        if (updateAppError) {
          console.error(`Error updating application ${merchant.id}:`, updateAppError);
          continue;
        }

        // Update merchant_public_profiles
        const { error: updateProfileError } = await supabase
          .from("merchant_public_profiles")
          .update({ badge_tier: newTier })
          .eq("id", merchant.user_id);

        if (updateProfileError) {
          console.error(`Error updating profile ${merchant.user_id}:`, updateProfileError);
        }

        updates.push({
          merchantId: merchant.id,
          userId: merchant.user_id,
          oldTier: merchant.badge_tier,
          newTier,
        });
        updatedCount++;
      }
    }

    return new Response(
      JSON.stringify({
        message: "Badge calculation completed",
        processed: merchants.length,
        updated: updatedCount,
        currentMonth,
        updates,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("Error in calculate-merchant-badges:", err);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
