import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('Starting auto-draw for ended timed competitions...')

    // Find active timed competitions that have ended
    const { data: endedCompetitions, error: fetchError } = await supabase
      .from('competitions')
      .select('*')
      .eq('status', 'active')
      .eq('competition_type', 'timed')
      .lt('end_date', new Date().toISOString())

    if (fetchError) {
      console.error('Error fetching ended competitions:', fetchError)
      throw fetchError
    }

    console.log(`Found ${endedCompetitions?.length || 0} ended competitions to draw`)

    const results = []

    for (const competition of endedCompetitions || []) {
      console.log(`Drawing winner for competition: ${competition.id} - ${competition.title_ar}`)

      // Check if competition has participants
      const { data: tickets, error: ticketsError } = await supabase
        .from('competition_tickets')
        .select('*')
        .eq('competition_id', competition.id)

      if (ticketsError) {
        console.error(`Error fetching tickets for ${competition.id}:`, ticketsError)
        results.push({
          competition_id: competition.id,
          title: competition.title_ar,
          success: false,
          error: 'فشل في جلب التذاكر'
        })
        continue
      }

      if (!tickets || tickets.length === 0) {
        console.log(`No participants in competition ${competition.id}, marking as completed without winner`)
        
        // Mark as completed without winner
        await supabase
          .from('competitions')
          .update({
            status: 'completed',
            draw_date: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', competition.id)

        results.push({
          competition_id: competition.id,
          title: competition.title_ar,
          success: true,
          message: 'تم إغلاق المسابقة بدون مشاركين'
        })
        continue
      }

      // Select random winner
      const randomIndex = Math.floor(Math.random() * tickets.length)
      const winnerTicket = tickets[randomIndex]

      // Get winner profile
      const { data: winnerProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', winnerTicket.user_id)
        .single()

      // Update competition with winner
      const { error: updateError } = await supabase
        .from('competitions')
        .update({
          status: 'completed',
          winner_user_id: winnerTicket.user_id,
          winner_ticket_id: winnerTicket.id,
          draw_date: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', competition.id)

      if (updateError) {
        console.error(`Error updating competition ${competition.id}:`, updateError)
        results.push({
          competition_id: competition.id,
          title: competition.title_ar,
          success: false,
          error: 'فشل في تحديث المسابقة'
        })
        continue
      }

      // Mark winning ticket
      await supabase
        .from('competition_tickets')
        .update({ is_winner: true })
        .eq('id', winnerTicket.id)

      // Create winner notification
      const prizeValueText = competition.prize_value 
        ? `\n💰 القيمة: ${competition.prize_value} ${competition.currency}`
        : ''

      await supabase
        .from('notifications')
        .insert({
          user_id: winnerTicket.user_id,
          title: '🎉 مبروك! لقد فزت في المسابقة!',
          message: `تهانينا ${winnerProfile?.full_name || winnerProfile?.username || 'الفائز'}! 🏆\n\n📌 المسابقة: ${competition.title_ar}\n🎁 الجائزة: ${competition.prize_description_ar}${prizeValueText}\n🎫 رقم تذكرتك الفائزة: ${winnerTicket.ticket_number}\n\n🤖 تم السحب تلقائياً عند انتهاء وقت المسابقة\n\nسيتم التواصل معك قريباً لتسليم الجائزة. شكراً لمشاركتك! 🙏`,
          type: 'success',
          related_id: competition.id
        })

      // Notify admins
      const { data: admins } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin')

      for (const admin of admins || []) {
        await supabase
          .from('notifications')
          .insert({
            user_id: admin.user_id,
            title: '🎲 تم سحب مسابقة تلقائياً',
            message: `تم سحب المسابقة "${competition.title_ar}" تلقائياً\n\nالفائز: ${winnerProfile?.full_name || winnerProfile?.username}\nرقم التذكرة: ${winnerTicket.ticket_number}\nعدد المشاركين: ${tickets.length}`,
            type: 'info',
            related_id: competition.id
          })
      }

      console.log(`Successfully drew winner for ${competition.id}: ${winnerTicket.ticket_number}`)

      results.push({
        competition_id: competition.id,
        title: competition.title_ar,
        success: true,
        winner_ticket: winnerTicket.ticket_number,
        winner_name: winnerProfile?.full_name || winnerProfile?.username,
        participants_count: tickets.length
      })
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error in auto-draw:', error)
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
