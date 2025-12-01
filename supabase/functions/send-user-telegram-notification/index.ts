import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// This function sends notifications to users who have telegram_chat_id set
// It can be called manually or via a webhook when a notification is created
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    
    if (!TELEGRAM_BOT_TOKEN) {
      console.error("Missing Telegram bot token");
      return new Response(
        JSON.stringify({ success: false, error: "Missing Telegram bot token" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { user_id, title, message, notification_type } = await req.json();

    if (!user_id || !title || !message) {
      return new Response(
        JSON.stringify({ success: false, error: "user_id, title, and message are required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Fetch user's telegram_chat_id
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("telegram_chat_id, full_name")
      .eq("id", user_id)
      .single();

    if (error) {
      console.error("Error fetching user profile:", error);
      return new Response(
        JSON.stringify({ success: false, error: "Error fetching user profile" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    if (!profile?.telegram_chat_id) {
      console.log("User has no telegram_chat_id set, skipping notification");
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "No telegram_chat_id for user" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Format the notification message
    const typeEmoji = notification_type === 'success' ? '✅' : 
                      notification_type === 'error' ? '❌' : 
                      notification_type === 'warning' ? '⚠️' : 'ℹ️';
    
    const telegramMessage = `${typeEmoji} <b>${title}</b>\n\n${message}\n\n🛍️ LEVONIS`;

    console.log(`Sending notification to user ${user_id} (chat_id: ${profile.telegram_chat_id})`);

    const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    
    const response = await fetch(telegramUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: profile.telegram_chat_id,
        text: telegramMessage,
        parse_mode: "HTML",
      }),
    });

    const result = await response.json();
    console.log("Telegram API response:", result);

    if (!result.ok) {
      console.error("Telegram API error:", result);
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
    console.error("Error sending user Telegram notification:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});