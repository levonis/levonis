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
    const callerId = (claimsData.claims as { sub?: string }).sub!;
    const isService = (claimsData.claims as { role?: string }).role === "service_role";
    const { data: roleRow } = await anonClient
      .from("user_roles").select("role").eq("user_id", callerId).eq("role", "admin").maybeSingle();
    const isAdmin = !!roleRow || isService;

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

    // Authorization: only admins can fire admin-style events.
    // For "new_message", require caller to be a participant of the target conversation.
    let safeSenderName = sender_name;
    let safeMessageContent = message_content;
    if (event_type === "new_message") {
      if (!conversation_id) {
        return new Response(JSON.stringify({ success: false, error: "conversation_id required" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
      }
      if (!isAdmin) {
        const { data: convo } = await supabase
          .from("listing_conversations")
          .select("buyer_id, seller_id")
          .eq("id", conversation_id)
          .maybeSingle();
        const participants = [convo?.buyer_id, convo?.seller_id].filter(Boolean);
        if (!convo || !participants.includes(callerId) || !participants.includes(user_id)) {
          return new Response(JSON.stringify({ success: false, error: "Forbidden" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 });
        }
        // Derive sender name from caller's profile (do not trust client value)
        const { data: callerProfile } = await supabase
          .from("profiles").select("full_name, username").eq("id", callerId).maybeSingle();
        safeSenderName = callerProfile?.full_name || callerProfile?.username || "مستخدم";
        // Strip any HTML from caller-provided message to prevent injection
        safeMessageContent = (message_content ? String(message_content) : "").replace(/<[^>]*>/g, "").slice(0, 500);
      }
    } else if (!isAdmin) {
      return new Response(JSON.stringify({ success: false, error: "Forbidden" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 });
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
        telegramMessage = `💬 <b>${(safeSenderName || 'مستخدم').toString().replace(/[<>]/g,'')}</b>${listing_title ? `\n📦 ${String(listing_title).replace(/[<>]/g,'')}` : ''}\n${safeMessageContent || '(صورة)'}`;
        break;
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
