
-- Fix Race Condition #1: purchase_competition_ticket - Add FOR UPDATE locking
CREATE OR REPLACE FUNCTION public.purchase_competition_ticket(comp_id UUID, quantity INTEGER DEFAULT 1)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID;
  comp_record RECORD;
  ticket_count INTEGER;
  total_cost NUMERIC;
  new_ticket_id UUID;
  new_ticket_number TEXT;
  user_wallet_balance NUMERIC;
  purchased_tickets jsonb[];
  i INTEGER;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'غير مصرح');
  END IF;

  IF quantity < 1 OR quantity > 100 THEN
    RETURN jsonb_build_object('success', false, 'error', 'الكمية يجب أن تكون بين 1 و 100');
  END IF;

  -- Lock competition row to prevent overselling
  SELECT * INTO comp_record
  FROM competitions
  WHERE id = comp_id AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'المسابقة غير موجودة أو غير نشطة');
  END IF;

  IF comp_record.competition_type = 'timed' AND comp_record.end_date < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'انتهى وقت المسابقة');
  END IF;

  IF comp_record.max_tickets IS NOT NULL THEN
    SELECT COUNT(*) INTO ticket_count
    FROM competition_tickets
    WHERE competition_id = comp_id;
    
    IF ticket_count + quantity > comp_record.max_tickets THEN
      RETURN jsonb_build_object('success', false, 'error', 'لا تتوفر تذاكر كافية. المتبقي: ' || (comp_record.max_tickets - ticket_count));
    END IF;
  END IF;

  total_cost := comp_record.ticket_price * quantity;

  IF total_cost > 0 THEN
    -- Lock wallet row to prevent race conditions
    SELECT balance INTO user_wallet_balance
    FROM user_wallets
    WHERE user_id = current_user_id
    FOR UPDATE;
    
    IF user_wallet_balance IS NULL OR user_wallet_balance < total_cost THEN
      RETURN jsonb_build_object('success', false, 'error', 'رصيد المحفظة غير كافٍ. المطلوب: ' || total_cost);
    END IF;
    
    UPDATE user_wallets
    SET balance = balance - total_cost, updated_at = now()
    WHERE user_id = current_user_id;
    
    INSERT INTO wallet_transactions (user_id, type, amount, status)
    VALUES (current_user_id, 'competition_ticket', -total_cost, 'completed');
  END IF;

  purchased_tickets := ARRAY[]::jsonb[];
  
  FOR i IN 1..quantity LOOP
    new_ticket_number := generate_ticket_number(comp_id);
    INSERT INTO competition_tickets (competition_id, user_id, ticket_number)
    VALUES (comp_id, current_user_id, new_ticket_number)
    RETURNING id INTO new_ticket_id;
    
    purchased_tickets := array_append(purchased_tickets, jsonb_build_object(
      'id', new_ticket_id, 'ticket_number', new_ticket_number
    ));
  END LOOP;

  INSERT INTO notifications (user_id, title, message, type, related_id)
  VALUES (
    current_user_id,
    'تم شراء تذاكر المسابقة',
    'تم شراء ' || quantity || ' تذكرة للمسابقة: ' || comp_record.title_ar,
    'success', comp_id
  );

  RETURN jsonb_build_object('success', true, 'tickets', purchased_tickets, 'quantity', quantity, 'total_cost', total_cost);
END;
$$;

-- Fix Race Condition #2: convert_points_to_wallet - Add FOR UPDATE locking
CREATE OR REPLACE FUNCTION public.convert_points_to_wallet(points_amount NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id UUID;
  settings_data JSONB;
  conversion_rate NUMERIC;
  money_amount NUMERIC;
  user_available_points NUMERIC;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'غير مصرح');
  END IF;

  SELECT setting_value INTO settings_data
  FROM default_settings
  WHERE setting_key = 'points_settings';

  conversion_rate := COALESCE((settings_data->>'conversion_rate')::NUMERIC, 100);
  money_amount := points_amount / conversion_rate;
  
  -- Lock points row to prevent double-spending
  SELECT available_points INTO user_available_points
  FROM user_points
  WHERE user_id = current_user_id
  FOR UPDATE;
  
  IF user_available_points IS NULL OR user_available_points < points_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'رصيد نقاط غير كافٍ');
  END IF;
  
  UPDATE user_points
  SET available_points = available_points - points_amount,
      redeemed_points = redeemed_points + points_amount,
      updated_at = now()
  WHERE user_id = current_user_id;
  
  INSERT INTO points_transactions (user_id, points, type, source, description)
  VALUES (current_user_id, -points_amount, 'redeemed', 'wallet_conversion', 'تحويل النقاط إلى رصيد المحفظة');
  
  -- Lock wallet row before adding balance
  PERFORM 1 FROM user_wallets WHERE user_id = current_user_id FOR UPDATE;
  
  INSERT INTO user_wallets (user_id, balance, currency)
  VALUES (current_user_id, money_amount, 'دينار عراقي')
  ON CONFLICT (user_id) DO UPDATE
  SET balance = user_wallets.balance + money_amount,
      updated_at = now();
  
  INSERT INTO wallet_transactions (user_id, type, amount, status)
  VALUES (current_user_id, 'points_conversion', money_amount, 'completed');
  
  INSERT INTO notifications (user_id, title, message, type)
  VALUES (current_user_id, 'تحويل نقاط', 'تم تحويل ' || points_amount || ' نقطة إلى ' || money_amount || ' في المحفظة', 'success');
  
  RETURN jsonb_build_object('success', true, 'points_deducted', points_amount, 'wallet_added', money_amount);
END;
$$;
