import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all active timed competitions ending in the next 24 hours
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const now = new Date();

    const { data: endingCompetitions, error: compError } = await supabase
      .from("competitions")
      .select("id, title_ar, end_date")
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

      // Send notification to each participant
      for (const userId of uniqueUserIds) {
        // Check if notification already sent today for this competition
        const today = new Date().toISOString().split('T')[0];
        
        const { data: existingNotif } = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", userId)
          .eq("related_id", comp.id)
          .eq("type", "warning")
          .gte("created_at", today)
          .limit(1);

        if (existingNotif && existingNotif.length > 0) {
          continue; // Already notified today
        }

        const { error: notifError } = await supabase
          .from("notifications")
          .insert({
            user_id: userId,
            title: "⏰ المسابقة تنتهي قريباً!",
            message: `المسابقة "${comp.title_ar}" ستنتهي خلال 24 ساعة. لا تفوت فرصتك!`,
            type: "warning",
            related_id: comp.id,
            is_general: false
          });

        if (!notifError) {
          totalNotifications++;
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Sent ${totalNotifications} notifications for ${endingCompetitions.length} competitions` 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in notify-competition-ending:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
