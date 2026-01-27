
-- Add rate limiting to prevent rapid-fire entries
CREATE OR REPLACE FUNCTION public.enter_competition(
  p_user_id UUID,
  p_competition_id UUID,
  p_ticket_count INTEGER DEFAULT 1,
  p_letter_awarded TEXT DEFAULT NULL,
  p_team TEXT DEFAULT NULL,
  p_prize_won JSONB DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  ticket_id UUID,
  ticket_number TEXT,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_balance INTEGER;
  v_required_tickets INTEGER;
  v_total_cost INTEGER;
  v_competition_type TEXT;
  v_competition_status TEXT;
  v_max_tickets INTEGER;
  v_current_sold INTEGER;
  v_ticket_id UUID;
  v_ticket_number TEXT;
  v_user_entries INTEGER;
  v_recent_entries INTEGER;
  i INTEGER;
BEGIN
  -- Verify caller is the owner
  IF auth.uid() IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, 'غير مصرح - يجب تسجيل الدخول'::TEXT;
    RETURN;
  END IF;
  
  IF auth.uid() != p_user_id THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, 'غير مصرح - لا يمكن الدخول بإسم مستخدم آخر'::TEXT;
    RETURN;
  END IF;

  IF p_ticket_count <= 0 OR p_ticket_count > 50 THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, 'عدد التذاكر غير صالح (الحد الأقصى 50)'::TEXT;
    RETURN;
  END IF;

  -- Rate limiting: max 10 entries per 5 seconds per user
  SELECT COUNT(*) INTO v_recent_entries
  FROM competition_tickets
  WHERE user_id = p_user_id
    AND purchased_at > NOW() - INTERVAL '5 seconds';
    
  IF v_recent_entries >= 10 THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, 'الرجاء الانتظار قليلاً قبل المحاولة مجدداً'::TEXT;
    RETURN;
  END IF;

  -- Lock competition row to prevent race conditions
  SELECT 
    c.required_tickets, 
    c.competition_type, 
    c.status,
    c.max_tickets,
    COALESCE((SELECT COUNT(*) FROM competition_tickets WHERE competition_id = c.id), 0)
  INTO v_required_tickets, v_competition_type, v_competition_status, v_max_tickets, v_current_sold
  FROM competitions c
  WHERE c.id = p_competition_id
  FOR UPDATE;

  IF v_required_tickets IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, 'المسابقة غير موجودة'::TEXT;
    RETURN;
  END IF;

  IF v_competition_status != 'active' THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, 'المسابقة غير نشطة'::TEXT;
    RETURN;
  END IF;

  -- Check max tickets limit
  IF v_max_tickets IS NOT NULL AND v_current_sold + p_ticket_count > v_max_tickets THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, 'تم بيع جميع التذاكر'::TEXT;
    RETURN;
  END IF;

  -- Check free competition limit (one entry per user)
  IF v_competition_type = 'free' THEN
    SELECT COUNT(*) INTO v_user_entries
    FROM competition_tickets
    WHERE user_id = p_user_id AND competition_id = p_competition_id;
    
    IF v_user_entries > 0 THEN
      RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, 'لقد شاركت مسبقاً في هذه المسابقة المجانية'::TEXT;
      RETURN;
    END IF;
    
    v_required_tickets := 0;
  END IF;

  v_total_cost := v_required_tickets * p_ticket_count;

  -- Lock user tickets row and verify balance
  IF v_total_cost > 0 THEN
    SELECT ticket_count INTO v_user_balance
    FROM user_tickets
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF v_user_balance IS NULL OR v_user_balance < v_total_cost THEN
      RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, 
        format('رصيد التذاكر غير كافٍ. المطلوب: %s، المتوفر: %s', v_total_cost, COALESCE(v_user_balance, 0))::TEXT;
      RETURN;
    END IF;

    -- Deduct tickets atomically
    UPDATE user_tickets
    SET ticket_count = ticket_count - v_total_cost,
        updated_at = NOW()
    WHERE user_id = p_user_id;
  END IF;

  -- Insert competition tickets
  FOR i IN 1..p_ticket_count LOOP
    v_ticket_number := 'T-' || UPPER(SUBSTRING(gen_random_uuid()::TEXT, 1, 8));
    
    INSERT INTO competition_tickets (
      user_id, 
      competition_id, 
      ticket_number,
      letter_awarded,
      team,
      prize_won,
      is_winner
    )
    VALUES (
      p_user_id, 
      p_competition_id, 
      v_ticket_number,
      p_letter_awarded,
      p_team,
      p_prize_won,
      p_letter_awarded IS NOT NULL OR p_prize_won IS NOT NULL
    )
    RETURNING id INTO v_ticket_id;
  END LOOP;

  RETURN QUERY SELECT TRUE, v_ticket_id, v_ticket_number, NULL::TEXT;
END;
$$;
