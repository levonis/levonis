-- Fix search_path security for enter_free_competition function
CREATE OR REPLACE FUNCTION public.enter_free_competition(comp_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID;
  comp_record RECORD;
  existing_ticket RECORD;
  new_ticket_number TEXT;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'غير مسجل الدخول');
  END IF;

  -- Get competition and verify it's free type
  SELECT * INTO comp_record
  FROM competitions
  WHERE id = comp_id 
    AND status = 'active' 
    AND competition_type = 'free';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'المسابقة غير متاحة أو ليست مجانية');
  END IF;

  -- Check if competition has ended
  IF comp_record.end_date IS NOT NULL AND comp_record.end_date < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'انتهت المسابقة');
  END IF;

  -- Check if user already entered (free competitions typically allow one entry)
  SELECT * INTO existing_ticket
  FROM competition_tickets
  WHERE competition_id = comp_id AND user_id = current_user_id
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'لقد شاركت في هذه المسابقة من قبل');
  END IF;

  -- Check max participants if set
  IF comp_record.max_tickets IS NOT NULL THEN
    DECLARE
      current_count INTEGER;
    BEGIN
      SELECT COUNT(*) INTO current_count
      FROM competition_tickets
      WHERE competition_id = comp_id;
      
      IF current_count >= comp_record.max_tickets THEN
        RETURN jsonb_build_object('success', false, 'error', 'اكتمل عدد المشاركين');
      END IF;
    END;
  END IF;

  -- Generate ticket number
  new_ticket_number := generate_ticket_number(comp_id);

  -- Create competition ticket entry (NO ticket deduction for free competitions)
  INSERT INTO competition_tickets (competition_id, user_id, ticket_number)
  VALUES (comp_id, current_user_id, new_ticket_number);

  RETURN jsonb_build_object(
    'success', true, 
    'ticket_number', new_ticket_number,
    'message', 'تم التسجيل في المسابقة المجانية بنجاح!'
  );
END;
$$;