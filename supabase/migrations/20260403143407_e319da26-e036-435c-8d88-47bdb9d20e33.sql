
CREATE OR REPLACE FUNCTION public.purchase_product_offer(p_offer_id UUID, p_quantity INTEGER DEFAULT 1)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID;
  offer_record RECORD;
  promo_record RECORD;
  v_total_cost NUMERIC;
  v_total_tickets INTEGER;
  v_bonus_tickets INTEGER := 0;
  v_total_points INTEGER;
  wallet_balance NUMERIC;
  new_purchase_id UUID;
  i INTEGER;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'غير مصرح');
  END IF;
  
  IF p_quantity < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'الكمية غير صالحة');
  END IF;
  
  PERFORM pg_advisory_xact_lock(hashtext('purchase_offer_' || current_user_id::text));
  
  SELECT * INTO offer_record FROM product_offers WHERE id = p_offer_id AND status = 'active';
  
  IF offer_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'العرض غير متوفر');
  END IF;
  
  IF offer_record.stock_quantity IS NOT NULL AND offer_record.stock_quantity < p_quantity THEN
    RETURN jsonb_build_object('success', false, 'error', 'الكمية المطلوبة غير متوفرة');
  END IF;
  
  v_total_cost := offer_record.price * p_quantity;
  v_total_tickets := COALESCE(offer_record.gift_tickets, 0) * p_quantity;
  v_total_points := COALESCE(offer_record.points_reward, 0) * p_quantity;
  
  SELECT * INTO promo_record FROM ticket_promotions
  WHERE is_active = true AND starts_at <= now() AND ends_at > now()
  ORDER BY bonus_tickets DESC LIMIT 1;
  
  IF promo_record IS NOT NULL THEN
    v_bonus_tickets := promo_record.bonus_tickets * p_quantity;
    v_total_tickets := v_total_tickets + v_bonus_tickets;
  END IF;
  
  SELECT balance INTO wallet_balance 
  FROM user_wallets 
  WHERE user_id = current_user_id
  FOR UPDATE;
  
  IF wallet_balance IS NULL OR wallet_balance < v_total_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'رصيد المحفظة غير كافٍ. الرصيد الحالي: ' || COALESCE(wallet_balance, 0)::TEXT || ' والمطلوب: ' || v_total_cost::TEXT);
  END IF;
  
  UPDATE user_wallets
  SET balance = balance - v_total_cost, updated_at = now()
  WHERE user_id = current_user_id;
  
  INSERT INTO wallet_transactions (user_id, type, amount, status, admin_notes)
  VALUES (current_user_id, 'product_purchase', -v_total_cost, 'completed', 
          'شراء ' || p_quantity || ' من ' || offer_record.title_ar);
  
  INSERT INTO product_offer_purchases (
    user_id, offer_id, quantity, unit_price, total_price, gift_tickets_awarded
  ) VALUES (
    current_user_id, p_offer_id, p_quantity, offer_record.price, v_total_cost, v_total_tickets
  ) RETURNING id INTO new_purchase_id;
  
  FOR i IN 1..p_quantity LOOP
    INSERT INTO user_purchased_products (
      user_id, offer_id, purchase_id, product_title, product_image, status
    ) VALUES (
      current_user_id, p_offer_id, new_purchase_id, offer_record.title_ar, offer_record.image_url, 'pending'
    );
  END LOOP;
  
  IF offer_record.stock_quantity IS NOT NULL THEN
    UPDATE product_offers
    SET stock_quantity = stock_quantity - p_quantity,
        total_sold = total_sold + p_quantity, updated_at = now()
    WHERE id = p_offer_id;
  ELSE
    UPDATE product_offers
    SET total_sold = total_sold + p_quantity, updated_at = now()
    WHERE id = p_offer_id;
  END IF;
  
  IF v_total_tickets > 0 THEN
    PERFORM set_config('app.bypass_ticket_fraud_check', 'true', true);
    
    INSERT INTO user_tickets (user_id, ticket_count)
    VALUES (current_user_id, v_total_tickets)
    ON CONFLICT (user_id) DO UPDATE
    SET ticket_count = user_tickets.ticket_count + v_total_tickets, updated_at = now();
  END IF;
  
  IF v_total_points > 0 THEN
    INSERT INTO points_transactions (user_id, points, type, source, description)
    VALUES (current_user_id, v_total_points, 'earn', 'offer_purchase', 
            'نقاط من شراء ' || offer_record.title_ar);
    
    INSERT INTO user_points (user_id, available_points, total_earned)
    VALUES (current_user_id, v_total_points, v_total_points)
    ON CONFLICT (user_id) DO UPDATE
    SET available_points = user_points.available_points + v_total_points,
        total_earned = user_points.total_earned + v_total_points, updated_at = now();
  END IF;
  
  INSERT INTO notifications (user_id, title, message, type)
  VALUES (current_user_id, 'تم الشراء بنجاح! 🎁', 
          CASE 
            WHEN v_bonus_tickets > 0 THEN
              'تم شراء ' || p_quantity || ' ' || offer_record.title_ar || ' وحصلت على ' || v_total_tickets || ' تذكرة (' || v_bonus_tickets || ' تذكرة إضافية بمناسبة ' || COALESCE(promo_record.title_ar, 'العرض') || ')'
            WHEN v_total_tickets > 0 AND v_total_points > 0 THEN 
              'تم شراء ' || p_quantity || ' ' || offer_record.title_ar || ' وحصلت على ' || v_total_tickets || ' تذكرة و ' || v_total_points || ' نقطة'
            WHEN v_total_tickets > 0 THEN 
              'تم شراء ' || p_quantity || ' ' || offer_record.title_ar || ' وحصلت على ' || v_total_tickets || ' تذكرة هدية'
            WHEN v_total_points > 0 THEN 
              'تم شراء ' || p_quantity || ' ' || offer_record.title_ar || ' وحصلت على ' || v_total_points || ' نقطة'
            ELSE 
              'تم شراء ' || p_quantity || ' ' || offer_record.title_ar || ' بنجاح'
          END,
          'success');
  
  RETURN jsonb_build_object(
    'success', true,
    'purchase_id', new_purchase_id,
    'total_cost', v_total_cost,
    'gift_tickets', v_total_tickets,
    'bonus_tickets', v_bonus_tickets,
    'points_awarded', v_total_points,
    'product_name', offer_record.title_ar,
    'promo_title', COALESCE(promo_record.title_ar, null)
  );
END;
$$;
