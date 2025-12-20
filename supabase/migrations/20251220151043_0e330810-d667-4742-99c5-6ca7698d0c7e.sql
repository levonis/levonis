-- Add winners_count column to competitions table for multiple winners
ALTER TABLE public.competitions 
ADD COLUMN IF NOT EXISTS winners_count integer NOT NULL DEFAULT 1;

-- Add column to store all winner IDs as array
ALTER TABLE public.competitions 
ADD COLUMN IF NOT EXISTS winner_user_ids uuid[] DEFAULT ARRAY[]::uuid[];

-- Add column to store all winner ticket IDs as array
ALTER TABLE public.competitions 
ADD COLUMN IF NOT EXISTS winner_ticket_ids uuid[] DEFAULT ARRAY[]::uuid[];

-- Create function to draw multiple winners
CREATE OR REPLACE FUNCTION public.draw_multiple_winners(comp_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  comp_record RECORD;
  winner_ticket RECORD;
  winner_profile RECORD;
  winners_drawn INTEGER := 0;
  all_winner_ids uuid[] := ARRAY[]::uuid[];
  all_winner_ticket_ids uuid[] := ARRAY[]::uuid[];
  winners_info jsonb[] := ARRAY[]::jsonb[];
  available_tickets uuid[];
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

  -- Get all available ticket IDs (not yet won)
  SELECT ARRAY_AGG(id) INTO available_tickets
  FROM competition_tickets
  WHERE competition_id = comp_id AND is_winner = false;

  IF available_tickets IS NULL OR array_length(available_tickets, 1) IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'لا يوجد مشاركين في المسابقة');
  END IF;

  -- Draw winners up to winners_count or available tickets
  WHILE winners_drawn < comp_record.winners_count AND array_length(available_tickets, 1) > 0 LOOP
    -- Select random winner from available tickets
    SELECT * INTO winner_ticket
    FROM competition_tickets
    WHERE id = available_tickets[1 + floor(random() * array_length(available_tickets, 1))::int]
    LIMIT 1;

    IF NOT FOUND THEN
      EXIT;
    END IF;

    -- Remove this ticket from available pool
    available_tickets := array_remove(available_tickets, winner_ticket.id);

    -- Get winner profile
    SELECT * INTO winner_profile
    FROM profiles
    WHERE id = winner_ticket.user_id;

    -- Mark winning ticket
    UPDATE competition_tickets
    SET is_winner = true
    WHERE id = winner_ticket.id;

    -- Add to arrays
    all_winner_ids := array_append(all_winner_ids, winner_ticket.user_id);
    all_winner_ticket_ids := array_append(all_winner_ticket_ids, winner_ticket.id);
    
    winners_info := array_append(winners_info, jsonb_build_object(
      'user_id', winner_ticket.user_id,
      'ticket_id', winner_ticket.id,
      'ticket_number', winner_ticket.ticket_number,
      'name', COALESCE(winner_profile.full_name, winner_profile.username, 'فائز')
    ));

    -- Create winner notification
    INSERT INTO notifications (user_id, title, message, type, related_id)
    VALUES (
      winner_ticket.user_id,
      '🎉 مبروك! لقد فزت في المسابقة!',
      'تهانينا ' || COALESCE(winner_profile.full_name, winner_profile.username, 'الفائز') || '! 🏆' || E'\n\n' ||
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

    winners_drawn := winners_drawn + 1;
  END LOOP;

  IF winners_drawn = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'لم يتم اختيار أي فائز');
  END IF;

  -- Update competition with all winners
  UPDATE competitions
  SET 
    status = 'completed',
    winner_user_id = all_winner_ids[1], -- Keep first winner for backward compatibility
    winner_ticket_id = all_winner_ticket_ids[1],
    winner_user_ids = all_winner_ids,
    winner_ticket_ids = all_winner_ticket_ids,
    draw_date = now(),
    updated_at = now()
  WHERE id = comp_id;

  -- Notify admins
  INSERT INTO notifications (user_id, title, message, type, related_id)
  SELECT 
    ur.user_id,
    '🎲 تم سحب المسابقة',
    'تم سحب المسابقة "' || comp_record.title_ar || '" - عدد الفائزين: ' || winners_drawn,
    'info',
    comp_id
  FROM user_roles ur
  WHERE ur.role = 'admin';

  RETURN jsonb_build_object(
    'success', true,
    'winners_count', winners_drawn,
    'winners', winners_info
  );
END;
$function$;

-- Update draw_competition_winner to use new structure
CREATE OR REPLACE FUNCTION public.draw_competition_winner(comp_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
  first_winner jsonb;
BEGIN
  -- Call the new multiple winners function
  result := draw_multiple_winners(comp_id);
  
  IF NOT (result->>'success')::boolean THEN
    RETURN result;
  END IF;

  -- Return in old format for backward compatibility
  first_winner := (result->'winners')->0;
  
  RETURN jsonb_build_object(
    'success', true,
    'winner_ticket_number', first_winner->>'ticket_number',
    'winner_name', first_winner->>'name',
    'winners_count', result->>'winners_count',
    'winners', result->'winners'
  );
END;
$function$;