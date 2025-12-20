import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface WinnerInfo {
  user_id: string;
  ticket_id: string;
  ticket_number: string;
  name: string;
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
      console.log(`Drawing winners for competition: ${competition.id} - ${competition.title_ar}`)

      // Send "draw happening" notification to participants before drawing
      try {
        await supabase.functions.invoke('notify-competition-telegram', {
          body: {
            type: 'draw_happening',
            competition_id: competition.id
          }
        })
        console.log('Sent draw happening notifications')
      } catch (telegramError) {
        console.error('Failed to send draw happening notifications:', telegramError)
      }

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

      // Get winners count (default to 1)
      const winnersCount = competition.winners_count || 1
      const availableTickets = [...tickets]
      const winners: WinnerInfo[] = []
      const winnerUserIds: string[] = []
      const winnerTicketIds: string[] = []

      // Draw multiple winners
      for (let i = 0; i < winnersCount && availableTickets.length > 0; i++) {
        const randomIndex = Math.floor(Math.random() * availableTickets.length)
        const winnerTicket = availableTickets.splice(randomIndex, 1)[0]

        // Get winner profile
        const { data: winnerProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', winnerTicket.user_id)
          .single()

        // Mark winning ticket
        await supabase
          .from('competition_tickets')
          .update({ is_winner: true })
          .eq('id', winnerTicket.id)

        const winnerName = winnerProfile?.full_name || winnerProfile?.username || 'الفائز'
        
        winners.push({
          user_id: winnerTicket.user_id,
          ticket_id: winnerTicket.id,
          ticket_number: winnerTicket.ticket_number,
          name: winnerName
        })
        
        winnerUserIds.push(winnerTicket.user_id)
        winnerTicketIds.push(winnerTicket.id)

        // Create winner notification
        const prizeValueText = competition.prize_value 
          ? `\n💰 القيمة: ${competition.prize_value} ${competition.currency}`
          : ''

        const winnerPosition = winnersCount > 1 ? ` (الفائز رقم ${i + 1} من ${winnersCount})` : ''

        await supabase
          .from('notifications')
          .insert({
            user_id: winnerTicket.user_id,
            title: '🎉 مبروك! لقد فزت في المسابقة!',
            message: `تهانينا ${winnerName}! 🏆${winnerPosition}\n\n📌 المسابقة: ${competition.title_ar}\n🎁 الجائزة: ${competition.prize_description_ar}${prizeValueText}\n🎫 رقم تذكرتك الفائزة: ${winnerTicket.ticket_number}\n\n🤖 تم السحب تلقائياً عند انتهاء وقت المسابقة\n\nسيتم التواصل معك قريباً لتسليم الجائزة. شكراً لمشاركتك! 🙏`,
            type: 'success',
            related_id: competition.id
          })

        // Send special winner announcement via Telegram
        try {
          await supabase.functions.invoke('notify-competition-telegram', {
            body: {
              type: 'winner_announcement',
              competition_id: competition.id,
              winner_user_id: winnerTicket.user_id,
              winner_ticket_number: winnerTicket.ticket_number
            }
          })
          console.log(`Sent winner announcement telegram notification for winner ${i + 1}`)
        } catch (telegramError) {
          console.error('Failed to send winner telegram notification:', telegramError)
        }
      }

      // Update competition with all winners
      const { error: updateError } = await supabase
        .from('competitions')
        .update({
          status: 'completed',
          winner_user_id: winnerUserIds[0],
          winner_ticket_id: winnerTicketIds[0],
          winner_user_ids: winnerUserIds,
          winner_ticket_ids: winnerTicketIds,
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

      // Notify admins
      const { data: admins } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin')

      const winnersText = winners.map((w, i) => `${i + 1}. ${w.name} (${w.ticket_number})`).join('\n')

      for (const admin of admins || []) {
        await supabase
          .from('notifications')
          .insert({
            user_id: admin.user_id,
            title: '🎲 تم سحب مسابقة تلقائياً',
            message: `تم سحب المسابقة "${competition.title_ar}" تلقائياً\n\nعدد الفائزين: ${winners.length}\n${winnersText}\n\nعدد المشاركين: ${tickets.length}`,
            type: 'info',
            related_id: competition.id
          })
      }

      // Send Telegram notifications for competition ended (non-winners)
      try {
        await supabase.functions.invoke('notify-competition-telegram', {
          body: {
            type: 'competition_ended',
            competition_id: competition.id,
            winner_user_ids: winnerUserIds
          }
        })
        console.log('Sent competition ended telegram notifications')
      } catch (telegramError) {
        console.error('Failed to send competition ended telegram notifications:', telegramError)
      }

      console.log(`Successfully drew ${winners.length} winners for ${competition.id}`)

      results.push({
        competition_id: competition.id,
        title: competition.title_ar,
        success: true,
        winners: winners.map(w => ({ name: w.name, ticket_number: w.ticket_number })),
        winners_count: winners.length,
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