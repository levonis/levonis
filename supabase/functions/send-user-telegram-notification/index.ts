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


    
    if (!TELEGRAM_BOT_TOKEN) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing Telegram bot token" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { user_id, title, message, notification_type, channel_key, review_question_id } = await req.json();

    if (!user_id || !title || !message) {
      return new Response(
        JSON.stringify({ success: false, error: "user_id, title, and message are required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Check global notification settings
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

    // Fetch user's telegram_chat_id AND telegram_notifications preferences
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("telegram_chat_id, full_name, telegram_notifications")
      .eq("id", user_id)
      .single();

    if (error || !profile?.telegram_chat_id) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "No telegram_chat_id" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Check user-level notification preferences
    const userNotifPrefs = profile.telegram_notifications as Record<string, boolean> | null;
    if (userNotifPrefs && channel_key) {
      // Map channel_key to user preference key
      const channelToUserPrefMap: Record<string, string> = {
        'order_updates': 'orders',
        'wallet_updates': 'wallet',
        'support_messages': 'support',
        'promotions': 'promotions',
        'community_messages': 'community_messages',
        'print_offers': 'print_offers',
        'merchant_updates': 'merchant_updates',
        // Direct keys also work
        'orders': 'orders',
        'wallet': 'wallet',
        'support': 'support',
      };
      
      const userPrefKey = channelToUserPrefMap[channel_key] || channel_key;
      if (userNotifPrefs[userPrefKey] === false) {
        return new Response(
          JSON.stringify({ success: true, skipped: true, reason: `User disabled ${channel_key} notifications` }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
    }

    // Compact formatted message
    const emoji = notification_type === 'success' ? '✅' : 
                  notification_type === 'error' ? '❌' : 
                  notification_type === 'warning' ? '⚠️' : 'ℹ️';
    
    const telegramMessage = `${emoji} <b>${title}</b>\n${message}`;

    const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    
    const body: any = {
      chat_id: profile.telegram_chat_id,
      text: telegramMessage,
      parse_mode: "HTML",
    };

    // If this is a review question, store context so user can reply via Telegram
    if (review_question_id) {
      await supabase.from("review_telegram_context").upsert({
        telegram_chat_id: profile.telegram_chat_id,
        question_id: review_question_id,
        user_id: user_id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'telegram_chat_id' });
    }

    const response = await fetch(telegramUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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
