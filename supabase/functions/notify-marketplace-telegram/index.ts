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

    const { 
      user_id, event_type, listing_title, listing_id, 
      admin_notes, buyer_name, message_content, sender_name, conversation_id 
    } = await req.json();

    if (!user_id || !event_type) {
      return new Response(
        JSON.stringify({ success: false, error: "user_id and event_type required" }),
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
          JSON.stringify({ success: true, skipped: true, reason: "Telegram disabled" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
      const chKey = event_type === "new_message" ? "chat_messages" : "marketplace_updates";
      if (ns.channels?.[chKey]?.telegram === false) {
        return new Response(
          JSON.stringify({ success: true, skipped: true, reason: `Channel ${chKey} disabled` }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
    }

    // Fetch user's telegram_chat_id
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("telegram_chat_id, full_name")
      .eq("id", user_id)
      .maybeSingle();

    if (error || !profile?.telegram_chat_id) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "No telegram_chat_id" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Compact notification messages
    let telegramMessage = "";

    switch (event_type) {
      case "listing_approved":
        telegramMessage = `✅ <b>تمت الموافقة</b>\n📦 ${listing_title}`;
        break;
      case "listing_rejected":
        telegramMessage = `❌ <b>تم رفض المنتج</b>\n📦 ${listing_title}${admin_notes ? `\n📝 ${admin_notes}` : ''}`;
        break;
      case "listing_sold":
        telegramMessage = `🎉 <b>تم البيع!</b>\n📦 ${listing_title}`;
        break;
      case "new_purchase":
        telegramMessage = `🛒 <b>طلب شراء</b>\n📦 ${listing_title}\n👤 ${buyer_name || 'مشتري'}`;
        break;
      case "new_message":
        telegramMessage = `💬 <b>${sender_name || 'مستخدم'}</b>${listing_title ? `\n📦 ${listing_title}` : ''}\n${message_content || '(صورة)'}`;
        break;
      default:
        telegramMessage = `📢 <b>إشعار</b>\n${listing_title || ''}`;
    }

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

    // Save context for reply
    if (event_type === "new_message" && conversation_id) {
      await supabase
        .from("marketplace_telegram_context")
        .upsert({
          telegram_chat_id: profile.telegram_chat_id,
          conversation_id,
          user_id,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'telegram_chat_id' });
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
