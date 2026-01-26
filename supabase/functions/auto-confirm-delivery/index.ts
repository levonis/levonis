import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Find requests that are delivered but not confirmed after 3 days
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const { data: pendingConfirmations, error: fetchError } = await supabase
      .from("community_print_requests")
      .select(`
        id,
        user_id,
        accepted_offer_id,
        escrow_amount,
        delivered_at
      `)
      .eq("status", "delivered")
      .is("customer_confirmed_at", null)
      .is("auto_confirmed_at", null)
      .lte("delivered_at", threeDaysAgo.toISOString());

    if (fetchError) throw fetchError;

    if (!pendingConfirmations || pendingConfirmations.length === 0) {
      return new Response(
        JSON.stringify({ message: "No pending confirmations to process" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${pendingConfirmations.length} auto-confirmations`);

    // Fetch platform commission rate
    const { data: commissionSetting } = await supabase
      .from("default_settings")
      .select("setting_value")
      .eq("setting_key", "platform_commission_rate")
      .maybeSingle();

    const commissionRate = (commissionSetting?.setting_value as { rate: number })?.rate || 0.007;

    let processedCount = 0;
    let errorCount = 0;

    for (const request of pendingConfirmations) {
      try {
        // Get the accepted offer details
        const { data: offer } = await supabase
          .from("print_offers")
          .select("id, trader_id, price_iqd")
          .eq("id", request.accepted_offer_id)
          .single();

        if (!offer) {
          console.error(`Offer not found for request ${request.id}`);
          errorCount++;
          continue;
        }

        // Get escrow transaction
        const { data: escrow } = await supabase
          .from("escrow_transactions")
          .select("id, merchant_payout, platform_fee")
          .eq("request_id", request.id)
          .eq("status", "held")
          .maybeSingle();

        if (!escrow) {
          console.error(`Escrow not found for request ${request.id}`);
          errorCount++;
          continue;
        }

        // Calculate payout
        const merchantPayout = escrow.merchant_payout || Math.floor(offer.price_iqd * (1 - commissionRate));

        // Get or create merchant wallet
        const { data: merchantWallet } = await supabase
          .from("user_wallets")
          .select("balance")
          .eq("user_id", offer.trader_id)
          .maybeSingle();

        if (merchantWallet) {
          await supabase
            .from("user_wallets")
            .update({ balance: merchantWallet.balance + merchantPayout })
            .eq("user_id", offer.trader_id);
        } else {
          await supabase.from("user_wallets").insert({
            user_id: offer.trader_id,
            balance: merchantPayout,
          });
        }

        // Record wallet transaction for merchant
        await supabase.from("wallet_transactions").insert({
          user_id: offer.trader_id,
          amount: merchantPayout,
          type: "escrow_release",
          status: "completed",
          description: `استلام مبلغ طلب طباعة - تأكيد تلقائي`,
        });

        // Update escrow status
        await supabase
          .from("escrow_transactions")
          .update({
            status: "released",
            released_at: new Date().toISOString(),
          })
          .eq("id", escrow.id);

        // Update request status
        await supabase
          .from("community_print_requests")
          .update({
            auto_confirmed_at: new Date().toISOString(),
            merchant_paid_at: new Date().toISOString(),
            merchant_paid_amount: merchantPayout,
            status: "completed",
          })
          .eq("id", request.id);

        // Update offer status
        await supabase
          .from("print_offers")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", offer.id);

        // Notify merchant
        await supabase.from("notifications").insert({
          user_id: offer.trader_id,
          title: "تم تحويل المبلغ ✓",
          message: `تم تأكيد الاستلام تلقائياً وتحويل ${merchantPayout.toLocaleString()} د.ع إلى محفظتك`,
          type: "escrow_released",
        });

        // Notify customer
        await supabase.from("notifications").insert({
          user_id: request.user_id,
          title: "تأكيد الاستلام التلقائي",
          message: `تم تأكيد استلام طلبك تلقائياً بعد مرور 3 أيام من التوصيل`,
          type: "auto_confirmation",
        });

        processedCount++;
        console.log(`Auto-confirmed request ${request.id}`);
      } catch (err) {
        console.error(`Error processing request ${request.id}:`, err);
        errorCount++;
      }
    }

    return new Response(
      JSON.stringify({
        message: `Processed ${processedCount} auto-confirmations`,
        errors: errorCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
