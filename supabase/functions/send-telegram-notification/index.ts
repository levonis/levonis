import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate JWT authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }


    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const DEFAULT_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");

    if (!TELEGRAM_BOT_TOKEN) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing Telegram bot token" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const { message, parse_mode = "HTML", chat_id, user_id, conversation_id, customer_user_id, channel_key, reply_markup } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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
          JSON.stringify({ success: true, skipped: true, reason: "Telegram disabled" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
      const chKey = channel_key || "chat_messages";
      if (ns.channels?.[chKey]?.telegram === false) {
        return new Response(
          JSON.stringify({ success: true, skipped: true, reason: `Channel ${chKey} disabled` }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
    }

    // Determine the target chat_id
    let targetChatId = chat_id || DEFAULT_CHAT_ID;

    if (user_id && !chat_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("telegram_chat_id")
        .eq("id", user_id)
        .single();

      if (profile?.telegram_chat_id) {
        targetChatId = profile.telegram_chat_id;
      } else {
        return new Response(
          JSON.stringify({ success: true, skipped: true, reason: "No telegram_chat_id" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
    }

    if (!targetChatId || !message) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing chat_id or message" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Update admin context for reply
    if (conversation_id && customer_user_id) {
      await supabase
        .from("admin_telegram_context")
        .upsert({
          admin_telegram_chat_id: targetChatId,
          conversation_id,
          user_id: customer_user_id,
          updated_at: new Date().toISOString(),
        }, { onConflict: "admin_telegram_chat_id" });
    }

    const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const telegramBody: Record<string, unknown> = {
      chat_id: targetChatId,
      text: message,
      parse_mode,
    };

    // Support inline keyboard buttons
    if (reply_markup) {
      telegramBody.reply_markup = reply_markup;
    }

    const response = await fetch(telegramUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(telegramBody),
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
