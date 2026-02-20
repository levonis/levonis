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
    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    
    if (!TELEGRAM_BOT_TOKEN) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing Telegram bot token" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { user_id, title, message, notification_type, channel_key } = await req.json();

    if (!user_id || !title || !message) {
      return new Response(
        JSON.stringify({ success: false, error: "user_id, title, and message are required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Check notification settings
    const { data: settings } = await supabase
      .from("default_settings")
      .select("setting_value")
      .eq("setting_key", "notification_settings")
      .maybeSingle();

    if (settings?.setting_value) {
      const ns = settings.setting_value as any;
      if (!ns.telegram_enabled) {
        return new Response(
          JSON.stringify({ success: true, skipped: true, reason: "Telegram disabled globally" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
      const chKey = channel_key || "general_notifications";
      if (ns.channels?.[chKey]?.telegram === false) {
        return new Response(
          JSON.stringify({ success: true, skipped: true, reason: `Telegram disabled for ${chKey}` }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
    }

    // Fetch user's telegram_chat_id
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("telegram_chat_id, full_name")
      .eq("id", user_id)
      .single();

    if (error || !profile?.telegram_chat_id) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "No telegram_chat_id" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Compact formatted message
    const emoji = notification_type === 'success' ? '✅' : 
                  notification_type === 'error' ? '❌' : 
                  notification_type === 'warning' ? '⚠️' : 'ℹ️';
    
    const telegramMessage = `${emoji} <b>${title}</b>\n${message}`;

    const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const response = await fetch(telegramUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: profile.telegram_chat_id,
        text: telegramMessage,
        parse_mode: "HTML",
      }),
    });

    const result = await response.json();

    if (!result.ok) {
      return new Response(
        JSON.stringify({ success: false, error: result.description }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message_id: result.result.message_id }),
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
