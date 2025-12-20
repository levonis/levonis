import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendTelegramMessage(botToken: string, chatId: string, message: string): Promise<boolean> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
      }),
    });
    const result = await response.json();
    return result.ok;
  } catch (error) {
    console.error(`Failed to send telegram to ${chatId}:`, error);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all active timed competitions ending in the next 24 hours
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const now = new Date();

    const { data: endingCompetitions, error: compError } = await supabase
      .from("competitions")
      .select("id, title_ar, prize_description_ar, end_date")
      .eq("status", "active")
      .eq("competition_type", "timed")
      .gte("end_date", now.toISOString())
      .lte("end_date", tomorrow.toISOString());

    if (compError) throw compError;

    if (!endingCompetitions || endingCompetitions.length === 0) {
      return new Response(
        JSON.stringify({ message: "No competitions ending soon" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalNotifications = 0;
    let totalTelegramSent = 0;

    for (const comp of endingCompetitions) {
      // Get all participants for this competition
      const { data: tickets, error: ticketsError } = await supabase
        .from("competition_tickets")
        .select("user_id")
        .eq("competition_id", comp.id);

      if (ticketsError) {
        console.error("Error fetching tickets:", ticketsError);
        continue;
      }

      // Get unique user IDs
      const uniqueUserIds = [...new Set(tickets?.map(t => t.user_id) || [])];

      // Get users with their telegram_chat_id
      const { data: users } = await supabase
        .from("profiles")
        .select("id, telegram_chat_id")
        .in("id", uniqueUserIds);

      // Send notification to each participant
      for (const user of users || []) {
        // Check if notification already sent today for this competition
        const today = new Date().toISOString().split('T')[0];
        
        const { data: existingNotif } = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", user.id)
          .eq("related_id", comp.id)
          .eq("type", "warning")
          .gte("created_at", today)
          .limit(1);

        if (existingNotif && existingNotif.length > 0) {
          continue; // Already notified today
        }

        // Create in-app notification
        const { error: notifError } = await supabase
          .from("notifications")
          .insert({
            user_id: user.id,
            title: "⏰ المسابقة تنتهي قريباً!",
            message: `المسابقة "${comp.title_ar}" ستنتهي خلال 24 ساعة. لا تفوت فرصتك!`,
            type: "warning",
            related_id: comp.id,
            is_general: false
          });

        if (!notifError) {
          totalNotifications++;
        }

        // Send Telegram notification if user has telegram_chat_id
        if (TELEGRAM_BOT_TOKEN && user.telegram_chat_id) {
          const telegramMessage = `⏰ <b>المسابقة تنتهي قريباً!</b>\n\n` +
            `📌 ${comp.title_ar}\n` +
            `🎁 الجائزة: ${comp.prize_description_ar}\n\n` +
            `⚠️ المسابقة ستنتهي خلال 24 ساعة!\n` +
            `لا تفوت فرصتك للفوز! 🍀\n\n` +
            `🛍️ LEVONIS`;

          const success = await sendTelegramMessage(TELEGRAM_BOT_TOKEN, user.telegram_chat_id, telegramMessage);
          if (success) totalTelegramSent++;
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Sent ${totalNotifications} in-app notifications and ${totalTelegramSent} telegram notifications for ${endingCompetitions.length} competitions` 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in notify-competition-ending:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
