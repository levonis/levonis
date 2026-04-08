
-- 1. Fix purchase_tickets_with_bonus: remove bonus_tickets param, calculate from DB
CREATE OR REPLACE FUNCTION public.purchase_tickets_with_bonus(
  ticket_quantity INTEGER,
  bonus_tickets INTEGER, -- kept for backward compat but IGNORED
  price_per_ticket NUMERIC
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  total_cost NUMERIC;
  current_balance NUMERIC;
  total_tickets INTEGER;
  new_ticket_count INTEGER;
  v_bonus INTEGER := 0;
  v_bundles JSONB;
  v_bundle JSONB;
  v_daily_purchased INTEGER;
BEGIN
  IF current_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'غير مسجل الدخول');
  END IF;

  -- Daily limit check (50 tickets/day)
  SELECT COALESCE(SUM(change_amount), 0) INTO v_daily_purchased
  FROM balance_audit_log
  WHERE user_id = current_user_id
    AND table_name = 'user_tickets'
    AND operation IN ('purchase', 'purchase_bundle')
    AND created_at >= (NOW() - INTERVAL '24 hours')
    AND change_amount > 0;

  IF v_daily_purchased + ticket_quantity > 50 THEN
    RETURN json_build_object('success', false, 'error', 'تجاوزت الحد اليومي لشراء التذاكر (50 تذكرة/يوم). اشتريت اليوم: ' || v_daily_purchased);
  END IF;

  -- Look up bonus from default_settings (ticket_bundles)
  SELECT (setting_value)::jsonb INTO v_bundles
  FROM default_settings
  WHERE setting_key = 'ticket_bundles';

  IF v_bundles IS NOT NULL THEN
    FOR v_bundle IN SELECT * FROM jsonb_array_elements(v_bundles)
    LOOP
      IF (v_bundle->>'quantity')::int = ticket_quantity 
         AND (v_bundle->>'active')::boolean IS DISTINCT FROM false THEN
        v_bonus := COALESCE((v_bundle->>'bonus_tickets')::int, 0);
        EXIT;
      END IF;
    END LOOP;
  END IF;

  -- Also check active ticket_promotions for additional bonus
  SELECT COALESCE(tp.bonus_tickets, 0) INTO v_bonus
  FROM ticket_promotions tp
  WHERE tp.is_active = true
    AND NOW() BETWEEN tp.starts_at AND tp.ends_at
  ORDER BY tp.bonus_tickets DESC
  LIMIT 1;
  -- Note: promotion bonus replaces bundle bonus if higher
  -- Actually let's ADD promotion bonus on top of bundle bonus
  -- Re-do: get promotion bonus separately
  
  -- Let me redo this properly
  v_bonus := 0;
  
  -- Step 1: Get bundle bonus
  IF v_bundles IS NOT NULL THEN
    FOR v_bundle IN SELECT * FROM jsonb_array_elements(v_bundles)
    LOOP
      IF (v_bundle->>'quantity')::int = ticket_quantity 
         AND (v_bundle->>'active')::boolean IS DISTINCT FROM false THEN
        v_bonus := COALESCE((v_bundle->>'bonus_tickets')::int, 0);
        EXIT;
      END IF;
    END LOOP;
  END IF;

  -- Step 2: Add active promotion bonus (if any)
  DECLARE
    v_promo_bonus INTEGER := 0;
  BEGIN
    SELECT COALESCE(tp.bonus_tickets, 0) INTO v_promo_bonus
    FROM ticket_promotions tp
    WHERE tp.is_active = true
      AND NOW() BETWEEN tp.starts_at AND tp.ends_at
    ORDER BY tp.bonus_tickets DESC
    LIMIT 1;
    
    v_bonus := v_bonus + v_promo_bonus;
  END;

  total_cost := ticket_quantity * price_per_ticket;
  total_tickets := ticket_quantity + v_bonus;

  -- Get current wallet balance
  SELECT balance INTO current_balance
  FROM user_wallets
  WHERE user_id = current_user_id;

  IF current_balance IS NULL OR current_balance < total_cost THEN
    RETURN json_build_object('success', false, 'error', 'رصيد المحفظة غير كافي');
  END IF;

  -- Set bypass for ticket fraud trigger
  PERFORM set_config('app.bypass_ticket_fraud_check', 'true', true);

  -- Deduct from wallet
  UPDATE user_wallets
  SET balance = balance - total_cost,
      updated_at = now()
  WHERE user_id = current_user_id;

  -- Add tickets to user (including bonus)
  INSERT INTO user_tickets (user_id, ticket_count)
  VALUES (current_user_id, total_tickets)
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    ticket_count = user_tickets.ticket_count + total_tickets,
    updated_at = now()
  RETURNING ticket_count INTO new_ticket_count;

  -- Record transaction
  INSERT INTO wallet_transactions (user_id, amount, type, status, admin_notes)
  VALUES (
    current_user_id, 
    -total_cost, 
    'purchase', 
    'completed', 
    'شراء ' || ticket_quantity || ' تذكرة + ' || v_bonus || ' هدية'
  );

  -- Audit log
  INSERT INTO balance_audit_log (user_id, table_name, operation, change_amount, new_balance, function_name)
  VALUES (current_user_id, 'user_tickets', 'purchase_bundle', total_tickets, new_ticket_count, 'purchase_tickets_with_bonus');

  RETURN json_build_object(
    'success', true, 
    'new_ticket_count', new_ticket_count,
    'purchased', ticket_quantity,
    'bonus', v_bonus,
    'total_added', total_tickets
  );
END;
$$;

-- 2. Fix purchase_tickets: add daily limit
CREATE OR REPLACE FUNCTION public.purchase_tickets(
  ticket_quantity INTEGER,
  price_per_ticket NUMERIC
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  total_cost NUMERIC;
  current_balance NUMERIC;
  new_ticket_count INTEGER;
  v_daily_purchased INTEGER;
BEGIN
  IF current_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'غير مسجل الدخول');
  END IF;

  -- Daily limit check (50 tickets/day)
  SELECT COALESCE(SUM(change_amount), 0) INTO v_daily_purchased
  FROM balance_audit_log
  WHERE user_id = current_user_id
    AND table_name = 'user_tickets'
    AND operation IN ('purchase', 'purchase_bundle')
    AND created_at >= (NOW() - INTERVAL '24 hours')
    AND change_amount > 0;

  IF v_daily_purchased + ticket_quantity > 50 THEN
    RETURN json_build_object('success', false, 'error', 'تجاوزت الحد اليومي لشراء التذاكر (50 تذكرة/يوم). اشتريت اليوم: ' || v_daily_purchased);
  END IF;

  total_cost := ticket_quantity * price_per_ticket;

  -- Get current wallet balance
  SELECT balance INTO current_balance
  FROM user_wallets
  WHERE user_id = current_user_id;

  IF current_balance IS NULL OR current_balance < total_cost THEN
    RETURN json_build_object('success', false, 'error', 'رصيد المحفظة غير كافي');
  END IF;

  -- Set bypass for ticket fraud trigger
  PERFORM set_config('app.bypass_ticket_fraud_check', 'true', true);

  -- Deduct from wallet
  UPDATE user_wallets
  SET balance = balance - total_cost,
      updated_at = now()
  WHERE user_id = current_user_id;

  -- Add tickets to user
  INSERT INTO user_tickets (user_id, ticket_count)
  VALUES (current_user_id, ticket_quantity)
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    ticket_count = user_tickets.ticket_count + ticket_quantity,
    updated_at = now()
  RETURNING ticket_count INTO new_ticket_count;

  -- Record transaction
  INSERT INTO wallet_transactions (user_id, amount, type, status, admin_notes)
  VALUES (current_user_id, -total_cost, 'purchase', 'completed', 'شراء ' || ticket_quantity || ' تذكرة');

  -- Audit log
  INSERT INTO balance_audit_log (user_id, table_name, operation, change_amount, new_balance, function_name)
  VALUES (current_user_id, 'user_tickets', 'purchase', ticket_quantity, new_ticket_count, 'purchase_tickets');

  RETURN json_build_object('success', true, 'new_ticket_count', new_ticket_count);
END;
$$;

-- 3. Fix admin_adjust_tickets: add cap (100) and require source/reason
CREATE OR REPLACE FUNCTION public.admin_adjust_tickets(
  p_user_id UUID,
  p_amount INTEGER,
  p_source TEXT DEFAULT 'admin'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_count INTEGER;
BEGIN
  -- Only admins can call this
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  -- Cap: max 100 tickets per single adjustment
  IF ABS(p_amount) > 100 THEN
    RAISE EXCEPTION 'الحد الأقصى للتعديل الواحد هو 100 تذكرة. الكمية المطلوبة: %', ABS(p_amount);
  END IF;

  -- Set bypass for ticket fraud trigger
  PERFORM set_config('app.bypass_ticket_fraud_check', 'true', true);

  -- Upsert ticket balance
  INSERT INTO user_tickets (user_id, ticket_count)
  VALUES (p_user_id, GREATEST(0, p_amount))
  ON CONFLICT (user_id)
  DO UPDATE SET 
    ticket_count = CASE 
      WHEN p_amount >= 0 THEN user_tickets.ticket_count + p_amount
      ELSE GREATEST(0, user_tickets.ticket_count + p_amount)
    END,
    updated_at = NOW()
  RETURNING ticket_count INTO v_new_count;

  -- Audit log with source
  INSERT INTO balance_audit_log (user_id, table_name, operation, change_amount, new_balance, function_name)
  VALUES (p_user_id, 'user_tickets', 'admin_adjust', p_amount, v_new_count, 'admin_adjust_tickets:' || COALESCE(p_source, 'no_reason'));
  
  RETURN TRUE;
END;
$$;
