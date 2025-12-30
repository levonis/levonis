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

    // Check if this is an admin replying to a customer (support chat)
    const { data: adminContext } = await supabase
      .from("admin_telegram_context")
      .select("conversation_id, user_id")
      .eq("admin_telegram_chat_id", chatId)
      .single();

    if (adminContext && text) {
      // This is an admin reply - insert the message into the conversation
      const { data: adminProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("telegram_chat_id", chatId)
        .single();

      if (adminProfile) {
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

    // Check if this is a marketplace conversation reply
    const { data: marketplaceContext } = await supabase
      .from("marketplace_telegram_context")
      .select("conversation_id, user_id")
      .eq("telegram_chat_id", chatId)
      .single();

    if (marketplaceContext && text) {
      // This is a marketplace reply
      const { data: userProfile } = await supabase
        .from("profiles")
        .select("id, full_name, username")
        .eq("telegram_chat_id", chatId)
        .single();

      if (userProfile) {
        // Insert the message into listing_messages
        const { error: msgError } = await supabase
          .from("listing_messages")
          .insert({
            conversation_id: marketplaceContext.conversation_id,
            sender_id: userProfile.id,
            content: text,
          });

        if (msgError) {
          console.error("Error inserting marketplace message:", msgError);
          await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chatId, "❌ حدث خطأ في إرسال الرسالة", "HTML");
        } else {
          // Update conversation updated_at
          await supabase
            .from("listing_conversations")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", marketplaceContext.conversation_id);

          // Get conversation details to notify the other party
          const { data: conversation } = await supabase
            .from("listing_conversations")
            .select(`
              buyer_id,
              seller_id,
              user_listings(title_ar)
            `)
            .eq("id", marketplaceContext.conversation_id)
            .single();

          if (conversation) {
            // Determine who to notify (the other party)
            const otherUserId = conversation.buyer_id === userProfile.id 
              ? conversation.seller_id 
              : conversation.buyer_id;

            // Notify the other party via telegram
            const { data: otherProfile } = await supabase
              .from("profiles")
              .select("telegram_chat_id")
              .eq("id", otherUserId)
              .single();

            if (otherProfile?.telegram_chat_id) {
              const senderName = userProfile.full_name || userProfile.username || 'مستخدم';
              const listingTitle = (conversation.user_listings as any)?.title_ar || 'منتج';
              
              const notifyMessage = `💬 <b>رسالة جديدة من ${senderName}</b>\n\n📦 المنتج: ${listingTitle}\n\n📩 الرسالة:\n${text}\n\n💡 للرد، اكتب رسالتك مباشرة هنا\n\n🏪 السوق المستعمل - LEVONIS`;
              
              await sendTelegramMessage(TELEGRAM_BOT_TOKEN, otherProfile.telegram_chat_id, notifyMessage, "HTML");

              // Update the other party's context so they can reply
              await supabase
                .from("marketplace_telegram_context")
                .upsert({
                  telegram_chat_id: otherProfile.telegram_chat_id,
                  conversation_id: marketplaceContext.conversation_id,
                  user_id: otherUserId,
                  updated_at: new Date().toISOString(),
                }, {
                  onConflict: 'telegram_chat_id',
                });
            }
          }

          await sendTelegramMessage(
            TELEGRAM_BOT_TOKEN,
            chatId,
            `✅ تم إرسال رسالتك`,
            "HTML"
          );
        }
      } else {
        await sendTelegramMessage(
          TELEGRAM_BOT_TOKEN,
          chatId,
          "⚠️ للرد، يرجى ربط حسابك في الموقع بهذا الـ Telegram ID أولاً",
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