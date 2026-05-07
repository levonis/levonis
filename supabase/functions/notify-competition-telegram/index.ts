import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationPayload {
  type: 'new_competition' | 'ending_soon' | 'draw_happening' | 'competition_ended' | 'winner_announcement';
  competition_id: string;
  winner_user_id?: string;
  winner_user_ids?: string[];
  winner_ticket_number?: string;
}

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
    // Require authenticated admin caller
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
    // Admin-only: prevent any signed-in user from mass-blasting Telegram DMs
    const callerId = (claimsData.claims as { sub?: string }).sub;
    const { data: roleRow } = await anonClient
      .from("user_roles").select("role").eq("user_id", callerId).eq("role", "admin").maybeSingle();
    const isService = (claimsData.claims as { role?: string }).role === "service_role";
    if (!roleRow && !isService) {
      return new Response(JSON.stringify({ success: false, error: "Forbidden" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 });
    }

    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!TELEGRAM_BOT_TOKEN) {
      throw new Error("Missing TELEGRAM_BOT_TOKEN");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload: NotificationPayload = await req.json();
    console.log("Received notification payload:", payload);

    // Get competition details
    const { data: competition, error: compError } = await supabase
      .from("competitions")
      .select("*")
      .eq("id", payload.competition_id)
      .single();

    if (compError || !competition) {
      throw new Error(`Competition not found: ${payload.competition_id}`);
    }

    let sentCount = 0;
    let message = "";

    switch (payload.type) {
      case 'new_competition': {
        // Send to ALL users with telegram_chat_id
        const { data: users } = await supabase
          .from("profiles")
          .select("id, telegram_chat_id, full_name, username")
          .not("telegram_chat_id", "is", null)
          .neq("telegram_chat_id", "");

        const prizeValue = competition.prize_value 
          ? `\n💰 قيمة الجائزة: ${competition.prize_value} ${competition.currency}`
          : "";

        const ticketPrice = competition.ticket_price > 0 
          ? `\n🎟️ سعر التذكرة: ${competition.ticket_price} ${competition.currency}`
          : "\n🎟️ مجانية!";

        const endDate = competition.end_date 
          ? `\n⏰ تنتهي في: ${new Date(competition.end_date).toLocaleDateString('ar-IQ')}`
          : "";

        message = `🎉 <b>مسابقة جديدة!</b>\n\n` +
          `📌 ${competition.title_ar}\n` +
          `🎁 الجائزة: ${competition.prize_description_ar}${prizeValue}${ticketPrice}${endDate}\n\n` +
          `🚀 سارع بالاشتراك الآن!\n\n` +
          `🛍️ LEVONIS`;

        console.log(`Sending new competition notification to ${users?.length || 0} users`);

        for (const user of users || []) {
          if (user.telegram_chat_id) {
            const success = await sendTelegramMessage(TELEGRAM_BOT_TOKEN, user.telegram_chat_id, message);
            if (success) sentCount++;
          }
        }
        break;
      }

      case 'ending_soon': {
        // Send to users who have tickets in this competition
        const { data: tickets } = await supabase
          .from("competition_tickets")
          .select("user_id")
          .eq("competition_id", payload.competition_id);

        const uniqueUserIds = [...new Set(tickets?.map(t => t.user_id) || [])];

        const { data: users } = await supabase
          .from("profiles")
          .select("id, telegram_chat_id")
          .in("id", uniqueUserIds)
          .not("telegram_chat_id", "is", null)
          .neq("telegram_chat_id", "");

        message = `⏰ <b>المسابقة تنتهي قريباً!</b>\n\n` +
          `📌 ${competition.title_ar}\n` +
          `🎁 الجائزة: ${competition.prize_description_ar}\n\n` +
          `⚠️ المسابقة ستنتهي خلال 24 ساعة!\n` +
          `لا تفوت فرصتك للفوز! 🍀\n\n` +
          `🛍️ LEVONIS`;

        console.log(`Sending ending soon notification to ${users?.length || 0} participants`);

        for (const user of users || []) {
          if (user.telegram_chat_id) {
            const success = await sendTelegramMessage(TELEGRAM_BOT_TOKEN, user.telegram_chat_id, message);
            if (success) sentCount++;
          }
        }
        break;
      }

      case 'draw_happening': {
        // Send to users who have tickets in this competition
        const { data: tickets } = await supabase
          .from("competition_tickets")
          .select("user_id")
          .eq("competition_id", payload.competition_id);

        const uniqueUserIds = [...new Set(tickets?.map(t => t.user_id) || [])];

        const { data: users } = await supabase
          .from("profiles")
          .select("id, telegram_chat_id")
          .in("id", uniqueUserIds)
          .not("telegram_chat_id", "is", null)
          .neq("telegram_chat_id", "");

        message = `🎲 <b>السحب جاري الآن!</b>\n\n` +
          `📌 ${competition.title_ar}\n` +
          `🎁 الجائزة: ${competition.prize_description_ar}\n\n` +
          `🤞 نتمنى لك حظاً سعيداً!\n` +
          `سيتم إعلان الفائز خلال لحظات...\n\n` +
          `🛍️ LEVONIS`;

        console.log(`Sending draw happening notification to ${users?.length || 0} participants`);

        for (const user of users || []) {
          if (user.telegram_chat_id) {
            const success = await sendTelegramMessage(TELEGRAM_BOT_TOKEN, user.telegram_chat_id, message);
            if (success) sentCount++;
          }
        }
        break;
      }

      case 'competition_ended': {
        // Send to users who have tickets but didn't win
        const { data: tickets } = await supabase
          .from("competition_tickets")
          .select("user_id")
          .eq("competition_id", payload.competition_id);

        const uniqueUserIds = [...new Set(tickets?.map(t => t.user_id) || [])];
        
        // Exclude all winners (support multiple winners)
        const winnerIds = payload.winner_user_ids || (payload.winner_user_id ? [payload.winner_user_id] : []);
        const nonWinnerIds = uniqueUserIds.filter(id => !winnerIds.includes(id));

        const { data: users } = await supabase
          .from("profiles")
          .select("id, telegram_chat_id")
          .in("id", nonWinnerIds)
          .not("telegram_chat_id", "is", null)
          .neq("telegram_chat_id", "");

        message = `🏁 <b>انتهت المسابقة</b>\n\n` +
          `📌 ${competition.title_ar}\n` +
          `🎁 الجائزة: ${competition.prize_description_ar}\n\n` +
          `😔 للأسف لم يحالفك الحظ هذه المرة\n` +
          `لكن لا تقلق! هناك مسابقات أخرى قادمة 🌟\n\n` +
          `شكراً لمشاركتك! 🙏\n\n` +
          `🛍️ LEVONIS`;

        console.log(`Sending competition ended notification to ${users?.length || 0} non-winners`);

        for (const user of users || []) {
          if (user.telegram_chat_id) {
            const success = await sendTelegramMessage(TELEGRAM_BOT_TOKEN, user.telegram_chat_id, message);
            if (success) sentCount++;
          }
        }
        break;
      }

      case 'winner_announcement': {
        // Send special notification to the winner
        if (!payload.winner_user_id) {
          throw new Error("Winner user ID is required for winner announcement");
        }

        const { data: winner } = await supabase
          .from("profiles")
          .select("telegram_chat_id, full_name, username")
          .eq("id", payload.winner_user_id)
          .single();

        if (!winner?.telegram_chat_id) {
          console.log("Winner has no telegram_chat_id");
          break;
        }

        const prizeValue = competition.prize_value 
          ? `\n💰 القيمة: ${competition.prize_value} ${competition.currency}`
          : "";

        message = `🎉🎉🎉 <b>مبروك! أنت الفائز!</b> 🎉🎉🎉\n\n` +
          `تهانينا ${winner.full_name || winner.username || 'الفائز'}! 🏆\n\n` +
          `📌 المسابقة: ${competition.title_ar}\n` +
          `🎁 الجائزة: ${competition.prize_description_ar}${prizeValue}\n` +
          `🎫 رقم التذكرة الفائزة: ${payload.winner_ticket_number}\n\n` +
          `📞 سيتم التواصل معك قريباً لتسليم الجائزة!\n\n` +
          `شكراً لمشاركتك في LEVONIS 🙏❤️`;

        console.log(`Sending winner announcement to ${winner.telegram_chat_id}`);
        
        const success = await sendTelegramMessage(TELEGRAM_BOT_TOKEN, winner.telegram_chat_id, message);
        if (success) sentCount++;
        break;
      }
    }

    console.log(`Successfully sent ${sentCount} telegram notifications`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        type: payload.type,
        sent_count: sentCount 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in notify-competition-telegram:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
