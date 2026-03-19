
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
  total_cost NUMERIC;
  total_tickets INTEGER;
  bonus_tickets INTEGER := 0;
  total_points INTEGER;
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
  
  total_cost := offer_record.price * p_quantity;
  total_tickets := COALESCE(offer_record.gift_tickets, 0) * p_quantity;
  total_points := COALESCE(offer_record.points_reward, 0) * p_quantity;
  
  -- Check for active ticket promotion
  SELECT * INTO promo_record FROM ticket_promotions
  WHERE is_active = true AND starts_at <= now() AND ends_at > now()
  ORDER BY bonus_tickets DESC LIMIT 1;
  
  IF promo_record IS NOT NULL THEN
    bonus_tickets := promo_record.bonus_tickets * p_quantity;
    total_tickets := total_tickets + bonus_tickets;
  END IF;
  
  SELECT balance INTO wallet_balance 
  FROM user_wallets 
  WHERE user_id = current_user_id
  FOR UPDATE;
  
  IF wallet_balance IS NULL OR wallet_balance < total_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'رصيد المحفظة غير كافٍ. الرصيد الحالي: ' || COALESCE(wallet_balance, 0)::TEXT || ' والمطلوب: ' || total_cost::TEXT);
  END IF;
  
  UPDATE user_wallets
  SET balance = balance - total_cost, updated_at = now()
  WHERE user_id = current_user_id;
  
  INSERT INTO wallet_transactions (user_id, type, amount, status, admin_notes)
  VALUES (current_user_id, 'product_purchase', -total_cost, 'completed', 
          'شراء ' || p_quantity || ' من ' || offer_record.title_ar);
  
  INSERT INTO product_offer_purchases (
    user_id, offer_id, quantity, unit_price, total_price, gift_tickets_awarded
  ) VALUES (
    current_user_id, p_offer_id, p_quantity, offer_record.price, total_cost, total_tickets
  ) RETURNING id INTO new_purchase_id;
  
  FOR i IN 1..p_quantity LOOP
    INSERT INTO user_purchased_products (
      user_id, product_id, product_name, product_name_ar, product_image,
      product_price, gift_tickets, source_type, order_status, currency
    ) VALUES (
      current_user_id, NULL, offer_record.title, offer_record.title_ar,
      offer_record.image_url, offer_record.price,
      COALESCE(offer_record.gift_tickets, 0) + COALESCE(promo_record.bonus_tickets, 0),
      'purchase', 'not_ordered', COALESCE(offer_record.currency, 'دينار')
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
  
  IF total_tickets > 0 THEN
    INSERT INTO user_tickets (user_id, ticket_count)
    VALUES (current_user_id, total_tickets)
    ON CONFLICT (user_id) DO UPDATE
    SET ticket_count = user_tickets.ticket_count + total_tickets, updated_at = now();
  END IF;
  
  IF total_points > 0 THEN
    INSERT INTO points_transactions (user_id, points, type, source, description)
    VALUES (current_user_id, total_points, 'earn', 'offer_purchase', 
            'نقاط من شراء ' || offer_record.title_ar);
    
    INSERT INTO user_points (user_id, available_points, total_earned)
    VALUES (current_user_id, total_points, total_points)
    ON CONFLICT (user_id) DO UPDATE
    SET available_points = user_points.available_points + total_points,
        total_earned = user_points.total_earned + total_points, updated_at = now();
  END IF;
  
  INSERT INTO notifications (user_id, title, message, type)
  VALUES (current_user_id, 'تم الشراء بنجاح! 🎁', 
          CASE 
            WHEN bonus_tickets > 0 THEN
              'تم شراء ' || p_quantity || ' ' || offer_record.title_ar || ' وحصلت على ' || total_tickets || ' تذكرة (' || bonus_tickets || ' تذكرة إضافية بمناسبة ' || COALESCE(promo_record.title_ar, 'العرض') || ')'
            WHEN total_tickets > 0 AND total_points > 0 THEN 
              'تم شراء ' || p_quantity || ' ' || offer_record.title_ar || ' وحصلت على ' || total_tickets || ' تذكرة و ' || total_points || ' نقطة'
            WHEN total_tickets > 0 THEN 
              'تم شراء ' || p_quantity || ' ' || offer_record.title_ar || ' وحصلت على ' || total_tickets || ' تذكرة هدية'
            WHEN total_points > 0 THEN 
              'تم شراء ' || p_quantity || ' ' || offer_record.title_ar || ' وحصلت على ' || total_points || ' نقطة'
            ELSE 
              'تم شراء ' || p_quantity || ' ' || offer_record.title_ar || ' بنجاح'
          END,
          'success');
  
  RETURN jsonb_build_object(
    'success', true,
    'purchase_id', new_purchase_id,
    'total_cost', total_cost,
    'gift_tickets', total_tickets,
    'bonus_tickets', bonus_tickets,
    'points_awarded', total_points,
    'product_name', offer_record.title_ar,
    'promo_title', COALESCE(promo_record.title_ar, null)
  );
END;
$$;
