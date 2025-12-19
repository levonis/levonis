-- Update draw_competition_winner function to call edge function for telegram notification
CREATE OR REPLACE FUNCTION public.draw_competition_winner(comp_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  comp_record RECORD;
  winner_ticket RECORD;
  winner_profile RECORD;
BEGIN
  -- Check if admin
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'غير مصرح');
  END IF;

  -- Get competition
  SELECT * INTO comp_record
  FROM competitions
  WHERE id = comp_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'المسابقة غير موجودة');
  END IF;

  IF comp_record.status = 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'تم السحب على هذه المسابقة مسبقاً');
  END IF;

  -- Select random winner
  SELECT * INTO winner_ticket
  FROM competition_tickets
  WHERE competition_id = comp_id
  ORDER BY random()
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'لا يوجد مشاركين في المسابقة');
  END IF;

  -- Update competition
  UPDATE competitions
  SET 
    status = 'completed',
    winner_user_id = winner_ticket.user_id,
    winner_ticket_id = winner_ticket.id,
    draw_date = now(),
    updated_at = now()
  WHERE id = comp_id;

  -- Mark winning ticket
  UPDATE competition_tickets
  SET is_winner = true
  WHERE id = winner_ticket.id;

  -- Get winner profile
  SELECT * INTO winner_profile
  FROM profiles
  WHERE id = winner_ticket.user_id;

  -- Create detailed winner notification (this will trigger telegram via existing trigger)
  INSERT INTO notifications (user_id, title, message, type, related_id)
  VALUES (
    winner_ticket.user_id,
    '🎉 مبروك! لقد فزت في المسابقة!',
    'تهانينا ' || COALESCE(winner_profile.full_name, winner_profile.username) || '! 🏆' || E'\n\n' ||
    '📌 المسابقة: ' || comp_record.title_ar || E'\n' ||
    '🎁 الجائزة: ' || comp_record.prize_description_ar || E'\n' ||
    CASE WHEN comp_record.prize_value IS NOT NULL 
      THEN '💰 القيمة: ' || comp_record.prize_value || ' ' || comp_record.currency || E'\n'
      ELSE ''
    END ||
    '🎫 رقم تذكرتك الفائزة: ' || winner_ticket.ticket_number || E'\n\n' ||
    'سيتم التواصل معك قريباً لتسليم الجائزة. شكراً لمشاركتك! 🙏',
    'success',
    comp_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'winner_ticket_number', winner_ticket.ticket_number,
    'winner_name', COALESCE(winner_profile.full_name, winner_profile.username)
  );
END;
$function$;