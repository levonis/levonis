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

    let totalAutoRated = 0;

    // ===== PART 1: Auto-rate products from site orders =====
    const { data: deliveredOrders, error: ordersError } = await supabase
      .from("orders")
      .select("id, user_id, delivered_at")
      .eq("status", "delivered")
      .not("delivered_at", "is", null)
      .lte("delivered_at", cutoff);

    if (ordersError) {
      console.error("Error fetching orders:", ordersError);
    }

    if (deliveredOrders && deliveredOrders.length > 0) {
      const orderIds = deliveredOrders.map((o) => o.id);

      // Get order items with product IDs
      const { data: orderItems, error: itemsError } = await supabase
        .from("order_items")
        .select("id, order_id, product_id")
        .in("order_id", orderIds);

      if (itemsError) {
        console.error("Error fetching order_items:", itemsError);
      }

      if (orderItems && orderItems.length > 0) {
        // Build user-product pairs from orders
        const orderMap = new Map(deliveredOrders.map((o) => [o.id, o]));
        const userProductPairs: { user_id: string; product_id: string; order_id: string }[] = [];

        for (const item of orderItems) {
          const order = orderMap.get(item.order_id);
          if (order && item.product_id) {
            userProductPairs.push({
              user_id: order.user_id,
              product_id: item.product_id,
              order_id: item.order_id,
            });
          }
        }

        // Get existing reviews for these user-product combinations
        const uniqueUserIds = [...new Set(userProductPairs.map((p) => p.user_id))];
        const uniqueProductIds = [...new Set(userProductPairs.map((p) => p.product_id))];

        const { data: existingReviews } = await supabase
          .from("reviews")
          .select("user_id, product_id")
          .in("user_id", uniqueUserIds)
          .in("product_id", uniqueProductIds);

        const reviewedSet = new Set(
          (existingReviews || []).map((r) => `${r.user_id}:${r.product_id}`)
        );

        // Count actual delivered orders per user+product pair
        const pairCountMap = new Map<string, number>();
        for (const pair of userProductPairs) {
          const key = `${pair.user_id}:${pair.product_id}`;
          pairCountMap.set(key, (pairCountMap.get(key) || 0) + 1);
        }

        // Deduplicate pairs
        const uniquePairs = Array.from(pairCountMap.entries()).map(([key, count]) => {
          const [user_id, product_id] = key.split(':');
          return { user_id, product_id, count };
        });

        for (const pair of uniquePairs) {
          const key = `${pair.user_id}:${pair.product_id}`;
          if (reviewedSet.has(key)) {
            // Already reviewed - SET reorder_count to actual order count (not increment)
            const { data: existingReview } = await supabase
              .from("reviews")
              .select("id, reorder_count")
              .eq("user_id", pair.user_id)
              .eq("product_id", pair.product_id)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            if (existingReview && (existingReview.reorder_count || 1) !== pair.count) {
              await supabase
                .from("reviews")
                .update({ reorder_count: pair.count })
                .eq("id", existingReview.id);
              totalAutoRated++;
            }
            continue;
          }

          // Create auto 5-star review
          const { error: insertError } = await supabase
            .from("reviews")
            .insert({
              user_id: pair.user_id,
              product_id: pair.product_id,
              rating: 5,
              comment: null,
              is_auto_rating: true,
              points_awarded: 0,
              reorder_count: pair.count,
            });

          if (insertError) {
            console.error("Error creating auto product review:", insertError);
          } else {
            reviewedSet.add(key);
            totalAutoRated++;
          }
        }
      }
    }

    // ===== PART 2: Auto-rate merchants from print requests =====
    const { data: printRequests, error: prError } = await supabase
      .from("print_requests")
      .select("id, user_id, accepted_offer_id, delivered_at")
      .eq("status", "delivered")
      .not("delivered_at", "is", null)
      .lte("delivered_at", cutoff);

    if (prError) {
      console.error("Error fetching print_requests:", prError);
    }

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

    if (allRequests.length > 0) {
      const requestIds = allRequests.map((r) => r.id);

      const { data: existingRatings } = await supabase
        .from("merchant_ratings")
        .select("request_id")
        .in("request_id", requestIds);

      const ratedRequestIds = new Set((existingRatings || []).map((r) => r.request_id));
      const unratedRequests = allRequests.filter((r) => !ratedRequestIds.has(r.id));

      if (unratedRequests.length > 0) {
        const offerIds = unratedRequests
          .map((r) => r.accepted_offer_id)
          .filter(Boolean);

        const { data: offers } = await supabase
          .from("print_offers")
          .select("id, trader_id")
          .in("id", offerIds);

        const offerMap = new Map((offers || []).map((o) => [o.id, o.trader_id]));

        const traderIds = [...new Set(Array.from(offerMap.values()))];
        const { data: merchantApps } = await supabase
          .from("merchant_applications")
          .select("id, user_id")
          .in("user_id", traderIds);

        const traderToMerchant = new Map(
          (merchantApps || []).map((m) => [m.user_id, m.id])
        );

        for (const request of unratedRequests) {
          if (!request.accepted_offer_id) continue;

          const traderId = offerMap.get(request.accepted_offer_id);
          if (!traderId) continue;

          const merchantId = traderToMerchant.get(traderId);
          if (!merchantId) continue;

          const { data: existingMerchantRating } = await supabase
            .from("merchant_ratings")
            .select("id, purchase_count")
            .eq("customer_id", request.user_id)
            .eq("merchant_id", merchantId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (existingMerchantRating) {
            await supabase
              .from("merchant_ratings")
              .update({
                purchase_count: (existingMerchantRating.purchase_count || 1) + 1,
              })
              .eq("id", existingMerchantRating.id);
            totalAutoRated++;
          } else {
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

            if (!insertError) totalAutoRated++;
            else console.error("Error creating merchant auto-rating:", insertError);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ message: "Auto-rating complete", count: totalAutoRated }),
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
