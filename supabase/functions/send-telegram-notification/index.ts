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
    const DEFAULT_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");

    if (!TELEGRAM_BOT_TOKEN) {
      console.error("Missing Telegram bot token");
      return new Response(
        JSON.stringify({ success: false, error: "Missing Telegram bot token" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const { message, parse_mode = "HTML", chat_id, user_id, conversation_id, customer_user_id } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Determine the target chat_id
    let targetChatId = chat_id || DEFAULT_CHAT_ID;

    // If user_id is provided, fetch the user's telegram_chat_id
    if (user_id && !chat_id) {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("telegram_chat_id")
        .eq("id", user_id)
        .single();

      if (error) {
        console.error("Error fetching user profile:", error);
      } else if (profile?.telegram_chat_id) {
        targetChatId = profile.telegram_chat_id;
      } else {
        // User doesn't have telegram_chat_id set, skip sending
        console.log("User has no telegram_chat_id set, skipping notification");
        return new Response(
          JSON.stringify({ success: true, skipped: true, reason: "No telegram_chat_id for user" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
    }

    if (!targetChatId) {
      console.error("No chat_id available");
      return new Response(
        JSON.stringify({ success: false, error: "No chat_id available" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    if (!message) {
      return new Response(
        JSON.stringify({ success: false, error: "Message is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    console.log(`Sending Telegram notification to chat_id ${targetChatId}:`, message);

    // If this is a chat notification for admin, update their context for reply
    if (conversation_id && customer_user_id) {
      await supabase
        .from("admin_telegram_context")
        .upsert({
          admin_telegram_chat_id: targetChatId,
          conversation_id: conversation_id,
          user_id: customer_user_id,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "admin_telegram_chat_id"
        });
      console.log(`Updated admin context for chat_id ${targetChatId} with conversation ${conversation_id}`);
    }

    const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    
    const response = await fetch(telegramUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: targetChatId,
        text: message,
        parse_mode: parse_mode,
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
    console.error("Error sending Telegram notification:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
