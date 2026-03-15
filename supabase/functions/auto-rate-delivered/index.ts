import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const cutoff = sevenDaysAgo.toISOString();

    // 1. Find delivered print_requests older than 7 days without a rating
    const { data: printRequests, error: prError } = await supabase
      .from("print_requests")
      .select("id, user_id, accepted_offer_id, delivered_at")
      .eq("status", "delivered")
      .not("delivered_at", "is", null)
      .lte("delivered_at", cutoff);

    if (prError) {
      console.error("Error fetching print_requests:", prError);
    }

    // 2. Find delivered community_print_requests older than 7 days without a rating
    const { data: communityRequests, error: crError } = await supabase
      .from("community_print_requests")
      .select("id, user_id, accepted_offer_id, delivered_at")
      .eq("status", "delivered")
      .not("delivered_at", "is", null)
      .lte("delivered_at", cutoff);

    if (crError) {
      console.error("Error fetching community_print_requests:", crError);
    }

    const allRequests = [...(printRequests || []), ...(communityRequests || [])];
    
    if (allRequests.length === 0) {
      return new Response(JSON.stringify({ message: "No requests to auto-rate", count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const requestIds = allRequests.map((r) => r.id);

    // Get existing ratings for these requests
    const { data: existingRatings } = await supabase
      .from("merchant_ratings")
      .select("request_id")
      .in("request_id", requestIds);

    const ratedRequestIds = new Set((existingRatings || []).map((r) => r.request_id));

    // Filter to unrated requests
    const unratedRequests = allRequests.filter((r) => !ratedRequestIds.has(r.id));

    if (unratedRequests.length === 0) {
      return new Response(JSON.stringify({ message: "All already rated", count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get merchant_ids from accepted offers
    const offerIds = unratedRequests
      .map((r) => r.accepted_offer_id)
      .filter(Boolean);

    const { data: offers } = await supabase
      .from("print_offers")
      .select("id, trader_id")
      .in("id", offerIds);

    const offerMap = new Map((offers || []).map((o) => [o.id, o.trader_id]));

    // Get merchant app IDs for traders
    const traderIds = [...new Set(Array.from(offerMap.values()))];
    const { data: merchantApps } = await supabase
      .from("merchant_applications")
      .select("id, user_id")
      .in("user_id", traderIds);

    const traderToMerchant = new Map(
      (merchantApps || []).map((m) => [m.user_id, m.id])
    );

    let autoRatedCount = 0;

    for (const request of unratedRequests) {
      if (!request.accepted_offer_id) continue;

      const traderId = offerMap.get(request.accepted_offer_id);
      if (!traderId) continue;

      const merchantId = traderToMerchant.get(traderId);
      if (!merchantId) continue;

      // Check if this customer already has a rating for this merchant
      const { data: existingMerchantRating } = await supabase
        .from("merchant_ratings")
        .select("id, purchase_count, review_text, image_urls, video_url, is_auto_rating")
        .eq("customer_id", request.user_id)
        .eq("merchant_id", merchantId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingMerchantRating) {
        // User already rated this merchant before - just increment purchase_count
        const { error: updateError } = await supabase
          .from("merchant_ratings")
          .update({ 
            purchase_count: (existingMerchantRating.purchase_count || 1) + 1 
          })
          .eq("id", existingMerchantRating.id);

        if (updateError) {
          console.error("Error updating purchase_count:", updateError);
        } else {
          autoRatedCount++;
        }
      } else {
        // No existing rating - create auto 5-star rating
        const { error: insertError } = await supabase
          .from("merchant_ratings")
          .insert({
            merchant_id: merchantId,
            customer_id: request.user_id,
            request_id: request.id,
            rating: 5,
            review_text: null,
            is_auto_rating: true,
            purchase_count: 1,
            points_awarded: 0,
          });

        if (insertError) {
          console.error("Error creating auto-rating:", insertError);
        } else {
          autoRatedCount++;
        }
      }
    }

    return new Response(
      JSON.stringify({ message: "Auto-rating complete", count: autoRatedCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Auto-rate error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
