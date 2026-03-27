import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sanitizeText = (text: string | undefined): string => {
  if (!text || typeof text !== 'string') return '';
  let sanitized = text.substring(0, 4096);
  let previous = '';
  while (previous !== sanitized) {
    previous = sanitized;
    sanitized = sanitized.replace(/<[^>]*>/g, '');
  }
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  return sanitized.trim();
};

const isValidChatId = (chatId: unknown): boolean => {
  if (chatId === null || chatId === undefined) return false;
  const id = Number(chatId);
  return Number.isInteger(id) && id !== 0;
};

async function sendTelegramMessage(botToken: string, chatId: string, text: string, parseMode: string = "HTML") {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: parseMode }),
  });
  return await response.json();
}

async function answerCallbackQuery(botToken: string, callbackQueryId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  });
}

async function editMessageReplyMarkup(botToken: string, chatId: string, messageId: number) {
  await fetch(`https://api.telegram.org/bot${botToken}/editMessageReplyMarkup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } }),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!TELEGRAM_BOT_TOKEN) {
      console.error("Missing Telegram bot token");
      return new Response(JSON.stringify({ success: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const update = await req.json();

    // ========== Handle Callback Query (inline button press) ==========
    if (update.callback_query) {
      const cbq = update.callback_query;
      const chatId = cbq.message?.chat?.id?.toString();
      const messageId = cbq.message?.message_id;
      const data = cbq.data; // e.g. "approve_task:uuid", "reject_merchant:uuid"

      if (!data || !chatId) {
        await answerCallbackQuery(TELEGRAM_BOT_TOKEN, cbq.id, "❌ خطأ");
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const [action, id] = data.split(":");
      
      try {
        switch (action) {
          // ===== Task Approval =====
          case "approve_task": {
            const { data: approval, error: fetchErr } = await supabase
              .from("pending_task_approvals")
              .select("*")
              .eq("id", id)
              .single();
            
            if (fetchErr || !approval) {
              await answerCallbackQuery(TELEGRAM_BOT_TOKEN, cbq.id, "❌ لم يتم العثور على الطلب");
              break;
            }
            if (approval.status !== 'pending') {
              await answerCallbackQuery(TELEGRAM_BOT_TOKEN, cbq.id, "⚠️ تم معالجة هذا الطلب مسبقاً");
              break;
            }

            // Get task info
            const { data: taskInfo } = await supabase
              .from("daily_tasks")
              .select("points_reward, title_ar")
              .eq("task_key", approval.task_key)
              .single();
            
            const totalPoints = taskInfo?.points_reward || 0;

            // Update approval
            await supabase.from("pending_task_approvals")
              .update({ status: 'approved', reviewed_at: new Date().toISOString(), admin_notes: 'تمت الموافقة من تيليكرام' })
              .eq("id", id);

            // Complete the task
            await supabase.from("user_task_completions")
              .insert({ user_id: approval.user_id, task_key: approval.task_key, points_earned: totalPoints });

            // Add points
            await supabase.from("points_transactions")
              .insert({ user_id: approval.user_id, points: totalPoints, type: 'earned', source: 'daily_task', description: `مهمة (موافقة): ${taskInfo?.title_ar || approval.task_key}` });

            const { data: currentPoints } = await supabase
              .from("user_points").select("*").eq("user_id", approval.user_id).maybeSingle();
            if (currentPoints) {
              await supabase.from("user_points").update({
                total_points: (currentPoints.total_points || 0) + totalPoints,
                available_points: (currentPoints.available_points || 0) + totalPoints,
              }).eq("user_id", approval.user_id);
            } else {
              await supabase.from("user_points").insert({
                user_id: approval.user_id, total_points: totalPoints, available_points: totalPoints,
              });
            }

            await editMessageReplyMarkup(TELEGRAM_BOT_TOKEN, chatId, messageId);
            await answerCallbackQuery(TELEGRAM_BOT_TOKEN, cbq.id, "✅ تمت الموافقة");
            await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chatId, `✅ تمت الموافقة على المهمة ومنح ${totalPoints} نقطة`);
            break;
          }

          case "reject_task": {
            const { data: approval } = await supabase
              .from("pending_task_approvals")
              .select("status")
              .eq("id", id)
              .single();
            
            if (!approval || approval.status !== 'pending') {
              await answerCallbackQuery(TELEGRAM_BOT_TOKEN, cbq.id, "⚠️ تم معالجة هذا الطلب مسبقاً");
              break;
            }

            await supabase.from("pending_task_approvals")
              .update({ status: 'rejected', reviewed_at: new Date().toISOString(), admin_notes: 'تم الرفض من تيليكرام' })
              .eq("id", id);

            await editMessageReplyMarkup(TELEGRAM_BOT_TOKEN, chatId, messageId);
            await answerCallbackQuery(TELEGRAM_BOT_TOKEN, cbq.id, "❌ تم الرفض");
            await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chatId, "❌ تم رفض المهمة");
            break;
          }

          // ===== Merchant Approval =====
          case "approve_merchant": {
            const { data: app } = await supabase
              .from("merchant_applications")
              .select("status, user_id")
              .eq("id", id)
              .single();
            
            if (!app || app.status !== 'pending') {
              await answerCallbackQuery(TELEGRAM_BOT_TOKEN, cbq.id, "⚠️ تم معالجة هذا الطلب مسبقاً");
              break;
            }

            // Get merchant fee from community settings
            const { data: feeSetting } = await supabase
              .from("community_settings")
              .select("value")
              .eq("key", "merchant_registration_fee")
              .maybeSingle();
            const fee = feeSetting?.value ? Number(feeSetting.value) : 0;

            // Deduct fee from wallet if needed
            if (fee > 0) {
              const { data: wallet } = await supabase
                .from("user_points")
                .select("available_points")
                .eq("user_id", app.user_id)
                .maybeSingle();
              
              if (!wallet || (wallet.available_points || 0) < fee) {
                await answerCallbackQuery(TELEGRAM_BOT_TOKEN, cbq.id, "⚠️ رصيد التاجر غير كافٍ لخصم الرسوم");
                await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chatId, `⚠️ لا يمكن قبول التاجر - رصيد المحفظة غير كافٍ (المطلوب: ${fee} نقطة)`);
                break;
              }
            }

            await supabase.from("merchant_applications")
              .update({ status: 'approved' })
              .eq("id", id);

            await editMessageReplyMarkup(TELEGRAM_BOT_TOKEN, chatId, messageId);
            await answerCallbackQuery(TELEGRAM_BOT_TOKEN, cbq.id, "✅ تم قبول التاجر");
            await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chatId, "✅ تم قبول طلب التاجر بنجاح");
            break;
          }

          case "reject_merchant": {
            const { data: app } = await supabase
              .from("merchant_applications")
              .select("status")
              .eq("id", id)
              .single();
            
            if (!app || app.status !== 'pending') {
              await answerCallbackQuery(TELEGRAM_BOT_TOKEN, cbq.id, "⚠️ تم معالجة هذا الطلب مسبقاً");
              break;
            }

            await supabase.from("merchant_applications")
              .update({ status: 'rejected' })
              .eq("id", id);

            await editMessageReplyMarkup(TELEGRAM_BOT_TOKEN, chatId, messageId);
            await answerCallbackQuery(TELEGRAM_BOT_TOKEN, cbq.id, "❌ تم رفض التاجر");
            await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chatId, "❌ تم رفض طلب التاجر");
            break;
          }

          // ===== Wish Approval =====
          case "approve_wish": {
            const { data: wish } = await supabase
              .from("wishes")
              .select("status")
              .eq("id", id)
              .single();
            
            if (!wish || wish.status !== 'pending') {
              await answerCallbackQuery(TELEGRAM_BOT_TOKEN, cbq.id, "⚠️ تم معالجة هذه الأمنية مسبقاً");
              break;
            }

            await supabase.from("wishes")
              .update({ status: 'approved' })
              .eq("id", id);

            await editMessageReplyMarkup(TELEGRAM_BOT_TOKEN, chatId, messageId);
            await answerCallbackQuery(TELEGRAM_BOT_TOKEN, cbq.id, "✅ تمت الموافقة على الأمنية");
            await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chatId, "✅ تمت الموافقة على الأمنية");
            break;
          }

          case "reject_wish": {
            await supabase.from("wishes")
              .update({ status: 'rejected' })
              .eq("id", id);

            await editMessageReplyMarkup(TELEGRAM_BOT_TOKEN, chatId, messageId);
            await answerCallbackQuery(TELEGRAM_BOT_TOKEN, cbq.id, "❌ تم رفض الأمنية");
            await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chatId, "❌ تم رفض الأمنية");
            break;
          }

          default:
            await answerCallbackQuery(TELEGRAM_BOT_TOKEN, cbq.id, "⚠️ إجراء غير معروف");
        }
      } catch (err) {
        console.error("Callback query error:", err);
        await answerCallbackQuery(TELEGRAM_BOT_TOKEN, cbq.id, "❌ حدث خطأ");
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== Handle Regular Message ==========
    const message = update.message;
    if (!message || !message.chat) {
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    if (!isValidChatId(message.chat.id)) {
      return new Response(JSON.stringify({ success: false, error: "Invalid chat ID" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400,
      });
    }

    const chatId = message.chat.id.toString();
    const text = sanitizeText(message.text);

    // /start command
    if (text === "/start" || text.startsWith("/start@")) {
      console.log(`/start command received from chat ${chatId}`);
      const responseText = `🔢 <b>رقم الـ Chat ID الخاص بك:</b>\n\n<code>${chatId}</code>\n\n📋 انسخ رقم الـ ID وضعه في إعدادات حسابك على الموقع لتفعيل إشعارات تيليكرام.`;
      await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chatId, responseText, "HTML");
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if this is an admin replying to a customer (support chat)
    const { data: adminContext } = await supabase
      .from("admin_telegram_context")
      .select("conversation_id, user_id")
      .eq("admin_telegram_chat_id", chatId)
      .single();

    if (adminContext && text) {
      let adminUserId: string | null = null;

      const { data: adminProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("telegram_chat_id", chatId)
        .single();

      if (adminProfile) {
        adminUserId = adminProfile.id;
      } else {
        const { data: adminRoles } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin");

        if (adminRoles && adminRoles.length > 0) {
          adminUserId = adminRoles[0].user_id;
          await supabase.from("profiles")
            .update({ telegram_chat_id: chatId })
            .eq("id", adminUserId);
        }
      }

      if (adminUserId) {
        const { error: msgError } = await supabase
          .from("messages")
          .insert({ conversation_id: adminContext.conversation_id, sender_id: adminUserId, content: text });

        if (msgError) {
          await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chatId, "❌ حدث خطأ في إرسال الرسالة");
        } else {
          const { data: customerProfile } = await supabase
            .from("profiles")
            .select("full_name, username")
            .eq("id", adminContext.user_id)
            .single();
          const customerName = customerProfile?.full_name || customerProfile?.username || "العميل";
          await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chatId, `✅ تم إرسال رسالتك إلى ${customerName}`);
        }
      } else {
        await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chatId, "⚠️ لا يوجد حساب أدمن مرتبط.");
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check marketplace conversation reply
    const { data: marketplaceContext } = await supabase
      .from("marketplace_telegram_context")
      .select("conversation_id, user_id")
      .eq("telegram_chat_id", chatId)
      .single();

    if (marketplaceContext && text) {
      let senderUserId = marketplaceContext.user_id;
      let senderName = '';

      const { data: userProfile } = await supabase
        .from("profiles")
        .select("id, full_name, username")
        .eq("id", marketplaceContext.user_id)
        .single();

      if (userProfile) {
        senderUserId = userProfile.id;
        senderName = userProfile.full_name || userProfile.username || 'مستخدم';
      }

      const { error: msgError } = await supabase
        .from("listing_messages")
        .insert({ conversation_id: marketplaceContext.conversation_id, sender_id: senderUserId, content: text });

      if (msgError) {
        await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chatId, "❌ حدث خطأ في إرسال الرسالة");
      } else {
        await supabase.from("listing_conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", marketplaceContext.conversation_id);

        const { data: conversation } = await supabase
          .from("listing_conversations")
          .select(`buyer_id, seller_id, user_listings(title_ar)`)
          .eq("id", marketplaceContext.conversation_id)
          .single();

        if (conversation) {
          const otherUserId = conversation.buyer_id === senderUserId
            ? conversation.seller_id : conversation.buyer_id;
          const { data: otherProfile } = await supabase
            .from("profiles")
            .select("telegram_chat_id")
            .eq("id", otherUserId)
            .single();

          if (otherProfile?.telegram_chat_id) {
            const listingTitle = (conversation.user_listings as any)?.title_ar || 'منتج';
            await sendTelegramMessage(TELEGRAM_BOT_TOKEN, otherProfile.telegram_chat_id,
              `💬 <b>رسالة جديدة من ${senderName}</b>\n\n📦 المنتج: ${listingTitle}\n\n📩 الرسالة:\n${text}\n\n💡 للرد، اكتب رسالتك مباشرة هنا\n\n🏪 LEVONIS`);

            await supabase.from("marketplace_telegram_context")
              .upsert({
                telegram_chat_id: otherProfile.telegram_chat_id,
                conversation_id: marketplaceContext.conversation_id,
                user_id: otherUserId,
                updated_at: new Date().toISOString(),
              }, { onConflict: 'telegram_chat_id' });
          }
        }
        await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chatId, `✅ تم إرسال رسالتك`);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check review Q&A reply context
    const { data: reviewContext } = await supabase
      .from("review_telegram_context")
      .select("question_id, user_id")
      .eq("telegram_chat_id", chatId)
      .single();

    if (reviewContext && text) {
      // Insert answer
      const { error: ansError } = await supabase
        .from("review_answers")
        .insert({
          question_id: reviewContext.question_id,
          answerer_id: reviewContext.user_id,
          answer: text,
        });

      if (ansError) {
        await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chatId, "❌ حدث خطأ في إرسال الإجابة");
      } else {
        // Award 5 points
        const { data: currentPoints } = await supabase
          .from("user_points")
          .select("*")
          .eq("user_id", reviewContext.user_id)
          .maybeSingle();

        if (currentPoints) {
          await supabase.from("user_points").update({
            total_points: (currentPoints.total_points || 0) + 5,
            available_points: (currentPoints.available_points || 0) + 5,
          }).eq("user_id", reviewContext.user_id);
        } else {
          await supabase.from("user_points").insert({
            user_id: reviewContext.user_id,
            total_points: 5,
            available_points: 5,
          });
        }

        await supabase.from("points_transactions").insert({
          user_id: reviewContext.user_id,
          points: 5,
          type: 'earned',
          source: 'review_answer',
          description: 'إجابة على سؤال في التقييمات (تيليكرام)',
        });

        // Clear context
        await supabase.from("review_telegram_context").delete().eq("telegram_chat_id", chatId);

        await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chatId, "✅ تم إرسال إجابتك بنجاح (+5 نقاط)");
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default response
    if (text) {
      const responseText = `🔢 رقم الـ ID الخاص بك:\n\`${chatId}\`\n\nانسخ رقم الـ ID الخاص بك وضعه في الموقع لتلقي الإشعارات.`;
      await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chatId, responseText, "Markdown");
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error in telegram-bot-webhook:", error);
    return new Response(JSON.stringify({ success: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
    });
  }
});
