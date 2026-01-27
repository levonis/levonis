-- Fix search_path for get_user_lock_key
DROP FUNCTION IF EXISTS get_user_lock_key(UUID);

CREATE OR REPLACE FUNCTION public.get_user_lock_key(p_user_id UUID)
RETURNS BIGINT 
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT ('x' || replace(p_user_id::text, '-', ''))::bit(64)::bigint;
$$;

-- Update enter_competition to use advisory locks and entry logging
DROP FUNCTION IF EXISTS public.enter_competition(UUID, UUID, INTEGER, TEXT, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.enter_competition(
  p_user_id UUID,
  p_competition_id UUID,
  p_ticket_count INTEGER,
  p_letter_awarded TEXT DEFAULT NULL,
  p_team TEXT DEFAULT NULL,
  p_prize_won JSONB DEFAULT NULL
)
RETURNS TABLE(success BOOLEAN, ticket_id UUID, ticket_number TEXT, error_message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_balance INTEGER;
  v_balance_snapshot INTEGER;
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
  v_lock_acquired BOOLEAN;
  i INTEGER;
BEGIN
  -- ========== LAYER 1: Authentication Check ==========
  IF auth.uid() IS NULL THEN
    INSERT INTO competition_entry_log (user_id, competition_id, tickets_requested, success, error_message)
    VALUES (COALESCE(p_user_id, '00000000-0000-0000-0000-000000000000'), p_competition_id, p_ticket_count, FALSE, 'Not authenticated');
    
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, 'غير مصرح - يجب تسجيل الدخول'::TEXT;
    RETURN;
  END IF;
  
  IF auth.uid() != p_user_id THEN
    INSERT INTO competition_entry_log (user_id, competition_id, tickets_requested, success, error_message)
    VALUES (p_user_id, p_competition_id, p_ticket_count, FALSE, 'User ID mismatch');
    
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, 'غير مصرح - لا يمكن الدخول بإسم مستخدم آخر'::TEXT;
    RETURN;
  END IF;

  -- ========== LAYER 2: Input Validation ==========
  IF p_ticket_count <= 0 OR p_ticket_count > 50 THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, 'عدد التذاكر غير صالح (الحد الأقصى 50)'::TEXT;
    RETURN;
  END IF;

  -- ========== LAYER 3: Acquire User-Level Advisory Lock ==========
  v_lock_acquired := pg_try_advisory_xact_lock(get_user_lock_key(p_user_id));
  
  IF NOT v_lock_acquired THEN
    INSERT INTO competition_entry_log (user_id, competition_id, tickets_requested, success, error_message)
    VALUES (p_user_id, p_competition_id, p_ticket_count, FALSE, 'Could not acquire lock - concurrent request');
    
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, 'يرجى الانتظار - عملية أخرى جارية'::TEXT;
    RETURN;
  END IF;

  -- ========== LAYER 4: Strict Rate Limiting (3 seconds) ==========
  SELECT COUNT(*) INTO v_recent_entries
  FROM competition_tickets
  WHERE user_id = p_user_id
    AND purchased_at > NOW() - INTERVAL '3 seconds';
    
  IF v_recent_entries > 0 THEN
    INSERT INTO competition_entry_log (user_id, competition_id, tickets_requested, success, error_message)
    VALUES (p_user_id, p_competition_id, p_ticket_count, FALSE, 'Rate limit exceeded');
    
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, 'الرجاء الانتظار 3 ثواني بين كل عملية'::TEXT;
    RETURN;
  END IF;

  -- ========== LAYER 5: Lock & Verify Competition ==========
  SELECT 
    c.required_tickets, 
    c.competition_type, 
    c.status,
    c.max_tickets
  INTO v_required_tickets, v_competition_type, v_competition_status, v_max_tickets
  FROM competitions c
  WHERE c.id = p_competition_id
  FOR UPDATE NOWAIT;

  IF v_required_tickets IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, 'المسابقة غير موجودة'::TEXT;
    RETURN;
  END IF;

  IF v_competition_status != 'active' THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, 'المسابقة غير نشطة'::TEXT;
    RETURN;
  END IF;

  -- Get current sold count
  SELECT COUNT(*) INTO v_current_sold
  FROM competition_tickets
  WHERE competition_id = p_competition_id;

  IF v_max_tickets IS NOT NULL AND v_current_sold + p_ticket_count > v_max_tickets THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, 'تم بيع جميع التذاكر'::TEXT;
    RETURN;
  END IF;

  -- ========== LAYER 6: Free Competition Check ==========
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

  -- ========== LAYER 7: Lock User Balance & Double-Verify ==========
  IF v_total_cost > 0 THEN
    -- Snapshot balance first
    SELECT ticket_count INTO v_balance_snapshot
    FROM user_tickets
    WHERE user_id = p_user_id;
    
    -- Lock row
    SELECT ticket_count INTO v_user_balance
    FROM user_tickets
    WHERE user_id = p_user_id
    FOR UPDATE NOWAIT;

    -- Verify snapshot matches (detect tampering)
    IF v_balance_snapshot IS DISTINCT FROM v_user_balance THEN
      INSERT INTO competition_entry_log (user_id, competition_id, tickets_requested, success, error_message, user_balance_before)
      VALUES (p_user_id, p_competition_id, p_ticket_count, FALSE, 'Balance changed during transaction', v_balance_snapshot);
      
      RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, 'حدث خطأ - يرجى المحاولة مجدداً'::TEXT;
      RETURN;
    END IF;

    IF v_user_balance IS NULL OR v_user_balance < v_total_cost THEN
      INSERT INTO competition_entry_log (user_id, competition_id, tickets_requested, success, error_message, user_balance_before)
      VALUES (p_user_id, p_competition_id, p_ticket_count, FALSE, 
        format('Insufficient: needed %s, had %s', v_total_cost, COALESCE(v_user_balance, 0)), v_user_balance);
      
      RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, 
        format('رصيد التذاكر غير كافٍ. المطلوب: %s، المتوفر: %s', v_total_cost, COALESCE(v_user_balance, 0))::TEXT;
      RETURN;
    END IF;

    -- ========== LAYER 8: Atomic Deduction with extra check ==========
    UPDATE user_tickets
    SET ticket_count = ticket_count - v_total_cost,
        updated_at = NOW()
    WHERE user_id = p_user_id
      AND ticket_count >= v_total_cost
    RETURNING ticket_count INTO v_user_balance;
    
    IF NOT FOUND OR v_user_balance IS NULL THEN
      INSERT INTO competition_entry_log (user_id, competition_id, tickets_requested, success, error_message, user_balance_before)
      VALUES (p_user_id, p_competition_id, p_ticket_count, FALSE, 'Deduction failed', v_balance_snapshot);
      
      RAISE EXCEPTION 'Ticket deduction failed';
    END IF;
  ELSE
    v_balance_snapshot := 0;
    v_user_balance := 0;
  END IF;

  -- ========== LAYER 9: Insert Tickets ==========
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

  -- ========== LAYER 10: Log Success ==========
  INSERT INTO competition_entry_log (
    user_id, competition_id, tickets_requested, tickets_deducted, 
    success, user_balance_before, user_balance_after
  )
  VALUES (
    p_user_id, p_competition_id, p_ticket_count, v_total_cost,
    TRUE, v_balance_snapshot, v_user_balance
  );

  RETURN QUERY SELECT TRUE, v_ticket_id, v_ticket_number, NULL::TEXT;
END;
$$;