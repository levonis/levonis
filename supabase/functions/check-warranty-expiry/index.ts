import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    // Find subscriptions expiring in exactly 15 days
    const fifteenDaysFromNow = new Date();
    fifteenDaysFromNow.setDate(fifteenDaysFromNow.getDate() + 15);
    const startOfDay = new Date(fifteenDaysFromNow);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(fifteenDaysFromNow);
    endOfDay.setHours(23, 59, 59, 999);

    // Check subscriptions with next_billing_date or end_date in 15 days
    const { data: expiringSubs, error } = await supabase
      .from("printer_subscriptions")
      .select(`
        id, user_id, status, next_billing_date, end_date, auto_renew,
        protection_plans(name_ar, plan_type),
        user_printers(store_printers(model_name_ar))
      `)
      .in("status", ["active"])
      .or(
        `next_billing_date.gte.${startOfDay.toISOString()},next_billing_date.lte.${endOfDay.toISOString()},end_date.gte.${startOfDay.toISOString()},end_date.lte.${endOfDay.toISOString()}`
      );

    if (error) {
      console.error("Error fetching expiring subscriptions:", error);
      throw error;
    }

    console.log(`Found ${expiringSubs?.length || 0} expiring subscriptions`);

    let notified = 0;
    for (const sub of expiringSubs || []) {
      const planName = (sub.protection_plans as any)?.name_ar || "الباقة";
      const printerName = (sub.user_printers as any)?.store_printers?.model_name_ar || "الطابعة";
      const expiryDate = sub.next_billing_date || sub.end_date;

      // Check if we already notified for this subscription (avoid duplicates)
      const { data: existingNotif } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", sub.user_id)
        .eq("related_id", sub.id)
        .eq("title", "تنبيه: اشتراك الحماية على وشك الانتهاء")
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .maybeSingle();

      if (existingNotif) continue;

      // Create notification
      await supabase.from("notifications").insert({
        user_id: sub.user_id,
        title: "تنبيه: اشتراك الحماية على وشك الانتهاء",
        message: `اشتراكك في خطة "${planName}" للطابعة "${printerName}" سينتهي خلال 15 يوماً. جدد أو قم بالترقية الآن للاستمرار بالاستفادة من مزايا الحماية.`,
        type: "warning",
        related_id: sub.id,
        is_general: false,
      });

      // Also send Telegram notification
      try {
        await supabase.functions.invoke("send-user-telegram-notification", {
          body: {
            user_id: sub.user_id,
            title: "⚠️ تنبيه: اشتراك الحماية على وشك الانتهاء",
            message: `اشتراكك في خطة "${planName}" سينتهي خلال 15 يوماً. جدد الآن!`,
            notification_type: "warning",
          },
        });
      } catch (e) {
        console.error("Telegram notification failed:", e);
      }

      notified++;
    }

    return new Response(
      JSON.stringify({ success: true, notified }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
