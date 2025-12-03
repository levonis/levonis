import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!TELEGRAM_BOT_TOKEN) {
      console.error("Missing Telegram bot token");
      return new Response(
        JSON.stringify({ success: false, error: "Missing Telegram bot token" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const update = await req.json();
    console.log("Received update:", update);

    // Extract message data
    const message = update.message;
    if (!message) {
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const chatId = message.chat.id.toString();
    const text = message.text;

    // Check if it's a /start command
    if (text === "/start") {
      const responseText = `🔢 رقم الـ ID الخاص بك:\n\`${chatId}\`\n\nانسخ رقم الـ ID الخاص بك وضعه في الموقع لتلقي الإشعارات.`;
      await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chatId, responseText, "Markdown");
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Check if this is an admin replying to a customer
    const { data: adminContext } = await supabase
      .from("admin_telegram_context")
      .select("conversation_id, user_id")
      .eq("admin_telegram_chat_id", chatId)
      .single();

    if (adminContext && text) {
      // This is an admin reply - insert the message into the conversation
      // First, find the admin's user_id by their telegram_chat_id
      const { data: adminProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("telegram_chat_id", chatId)
        .single();

      if (adminProfile) {
        // Insert the message
        const { error: msgError } = await supabase
          .from("messages")
          .insert({
            conversation_id: adminContext.conversation_id,
            sender_id: adminProfile.id,
            content: text,
          });

        if (msgError) {
          console.error("Error inserting message:", msgError);
          await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chatId, "❌ حدث خطأ في إرسال الرسالة", "HTML");
        } else {
          // Get customer name for confirmation
          const { data: customerProfile } = await supabase
            .from("profiles")
            .select("full_name, username")
            .eq("id", adminContext.user_id)
            .single();

          const customerName = customerProfile?.full_name || customerProfile?.username || "العميل";
          await sendTelegramMessage(
            TELEGRAM_BOT_TOKEN,
            chatId,
            `✅ تم إرسال رسالتك إلى ${customerName}`,
            "HTML"
          );
        }
      } else {
        // Admin hasn't linked their Telegram account
        await sendTelegramMessage(
          TELEGRAM_BOT_TOKEN,
          chatId,
          "⚠️ للرد على العملاء، يرجى ربط حسابك في الموقع بهذا الـ Telegram ID أولاً",
          "HTML"
        );
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Default response for non-admin users or if no context
    if (text) {
      const responseText = `🔢 رقم الـ ID الخاص بك:\n\`${chatId}\`\n\nانسخ رقم الـ ID الخاص بك وضعه في الموقع لتلقي الإشعارات.`;
      await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chatId, responseText, "Markdown");
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in telegram-bot-webhook:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string,
  parseMode: string = "HTML"
) {
  const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const response = await fetch(telegramUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: parseMode,
    }),
  });
  const result = await response.json();
  console.log("Telegram API response:", result);
  return result;
}
