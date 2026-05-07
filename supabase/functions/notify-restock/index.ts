import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require authenticated caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 });
    }
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 });
    }
    // Admin or service_role only (DB trigger calls with service role)
    const callerId = (claimsData.claims as { sub?: string }).sub;
    const isService = (claimsData.claims as { role?: string }).role === "service_role";
    if (!isService) {
      const { data: roleRow } = await anonClient
        .from("user_roles").select("role").eq("user_id", callerId).eq("role", "admin").maybeSingle();
      if (!roleRow) {
        return new Response(JSON.stringify({ success: false, error: "Forbidden" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 });
      }
    }

    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { product_id, product_title } = await req.json();

    if (!product_id) {
      return new Response(
        JSON.stringify({ success: false, error: "product_id is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Get subscribers who were just notified (notified_at within last minute)
    const { data: subscribers, error: subErr } = await supabase
      .from("stock_notifications")
      .select("user_id")
      .eq("product_id", product_id)
      .not("notified_at", "is", null)
      .gte("notified_at", new Date(Date.now() - 120000).toISOString());

    if (subErr || !subscribers?.length) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, reason: "No recent subscribers to notify" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    if (!TELEGRAM_BOT_TOKEN) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, reason: "No Telegram bot token" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const userIds = [...new Set(subscribers.map(s => s.user_id))];

    // Get profiles with telegram_chat_id
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, telegram_chat_id, full_name")
      .in("id", userIds)
      .not("telegram_chat_id", "is", null);

    let sent = 0;
    const title = product_title || "منتج";

    for (const profile of (profiles || [])) {
      if (!profile.telegram_chat_id) continue;

      const message = `🎉 <b>المنتج متوفر الآن!</b>\n\nالمنتج "<b>${title}</b>" أصبح متوفراً للبيع المباشر.\n\nسارع بالطلب قبل نفاد الكمية! 🛒`;

      try {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: profile.telegram_chat_id,
            text: message,
            parse_mode: "HTML",
          }),
        });
        sent++;
      } catch (e) {
        console.error(`Failed to send to ${profile.id}:`, e);
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
