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
      console.error("Missing Telegram bot token");
      return new Response(
        JSON.stringify({ success: false, error: "Missing Telegram bot token" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { 
      user_id, 
      event_type, 
      listing_title, 
      listing_id, 
      admin_notes, 
      buyer_name, 
      message_content,
      sender_name,
      conversation_id 
    } = await req.json();

    if (!user_id || !event_type) {
      return new Response(
        JSON.stringify({ success: false, error: "user_id and event_type are required" }),
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

    // Format the notification message based on event type
    let title = "";
    let message = "";
    let emoji = "";

    switch (event_type) {
      case "listing_approved":
        emoji = "✅";
        title = "تمت الموافقة على منتجك";
        message = `تمت الموافقة على منتج "${listing_title}" وهو الآن معروض في السوق المستعمل.`;
        break;
      case "listing_rejected":
        emoji = "❌";
        title = "تم رفض منتجك";
        message = `تم رفض منتج "${listing_title}".\n\n📝 السبب: ${admin_notes || 'لم يتم تحديد سبب'}`;
        break;
      case "listing_sold":
        emoji = "🎉";
        title = "تم بيع منتجك";
        message = `تهانينا! تم بيع منتج "${listing_title}" بنجاح.`;
        break;
      case "new_purchase":
        emoji = "🛒";
        title = "طلب شراء جديد";
        message = `لديك طلب شراء جديد لمنتج "${listing_title}" من ${buyer_name || 'مشتري'}.`;
        break;
      case "new_message":
        emoji = "💬";
        title = `رسالة جديدة من ${sender_name || 'مستخدم'}`;
        message = `📦 المنتج: ${listing_title}\n\n📩 الرسالة:\n${message_content || '(صورة)'}\n\n💡 للرد، اكتب رسالتك مباشرة هنا`;
        break;
      default:
        emoji = "ℹ️";
        title = "إشعار السوق المستعمل";
        message = `لديك إشعار جديد بخصوص منتج "${listing_title}".`;
    }

    const telegramMessage = `${emoji} <b>${title}</b>\n\n${message}\n\n🏪 السوق المستعمل - LEVONIS`;

    console.log(`Sending marketplace notification to user ${user_id} (chat_id: ${profile.telegram_chat_id})`);

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

    // Save context for reply functionality (for new_message events)
    if (event_type === "new_message" && conversation_id) {
      const { error: contextError } = await supabase
        .from("marketplace_telegram_context")
        .upsert({
          telegram_chat_id: profile.telegram_chat_id,
          conversation_id: conversation_id,
          user_id: user_id,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'telegram_chat_id',
        });

      if (contextError) {
        console.error("Error saving marketplace telegram context:", contextError);
      } else {
        console.log("Saved marketplace telegram context for replies");
      }
    }

    return new Response(
      JSON.stringify({ success: true, message_id: result.result.message_id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error sending marketplace Telegram notification:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});