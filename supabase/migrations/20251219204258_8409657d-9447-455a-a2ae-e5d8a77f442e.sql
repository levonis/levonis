
-- Update purchase function to accept quantity
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

  -- Get competition details
  SELECT * INTO comp_record
  FROM competitions
  WHERE id = comp_id AND status = 'active';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'المسابقة غير موجودة أو غير نشطة');
  END IF;

  -- Check if timed competition has ended
  IF comp_record.competition_type = 'timed' AND comp_record.end_date < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'انتهى وقت المسابقة');
  END IF;

  -- Check max tickets
  IF comp_record.max_tickets IS NOT NULL THEN
    SELECT COUNT(*) INTO ticket_count
    FROM competition_tickets
    WHERE competition_id = comp_id;
    
    IF ticket_count + quantity > comp_record.max_tickets THEN
      RETURN jsonb_build_object('success', false, 'error', 'لا تتوفر تذاكر كافية. المتبقي: ' || (comp_record.max_tickets - ticket_count));
    END IF;
  END IF;

  -- Calculate total cost
  total_cost := comp_record.ticket_price * quantity;

  -- If not free, check wallet balance and deduct
  IF total_cost > 0 THEN
    SELECT balance INTO user_wallet_balance
    FROM user_wallets
    WHERE user_id = current_user_id;
    
    IF user_wallet_balance IS NULL OR user_wallet_balance < total_cost THEN
      RETURN jsonb_build_object('success', false, 'error', 'رصيد المحفظة غير كافٍ. المطلوب: ' || total_cost);
    END IF;
    
    -- Deduct from wallet
    UPDATE user_wallets
    SET balance = balance - total_cost,
        updated_at = now()
    WHERE user_id = current_user_id;
    
    -- Record wallet transaction
    INSERT INTO wallet_transactions (user_id, type, amount, status)
    VALUES (current_user_id, 'competition_ticket', -total_cost, 'completed');
  END IF;

  -- Create tickets
  purchased_tickets := ARRAY[]::jsonb[];
  
  FOR i IN 1..quantity LOOP
    -- Generate ticket number
    new_ticket_number := generate_ticket_number(comp_id);

    -- Create ticket
    INSERT INTO competition_tickets (competition_id, user_id, ticket_number)
    VALUES (comp_id, current_user_id, new_ticket_number)
    RETURNING id INTO new_ticket_id;
    
    purchased_tickets := array_append(purchased_tickets, jsonb_build_object(
      'id', new_ticket_id,
      'ticket_number', new_ticket_number
    ));
  END LOOP;

  -- Send notification
  INSERT INTO notifications (user_id, title, message, type, related_id)
  VALUES (
    current_user_id,
    'تم شراء تذاكر المسابقة',
    'تم شراء ' || quantity || ' تذكرة للمسابقة: ' || comp_record.title_ar,
    'success',
    comp_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'tickets', purchased_tickets,
    'quantity', quantity,
    'total_cost', total_cost
  );
END;
$$;
