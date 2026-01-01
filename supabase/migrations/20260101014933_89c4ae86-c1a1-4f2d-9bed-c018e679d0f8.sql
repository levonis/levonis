-- Update purchase_product_offer to also create user_purchased_products record
CREATE OR REPLACE FUNCTION public.purchase_product_offer(p_offer_id uuid, p_quantity integer DEFAULT 1)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_user_id UUID;
  offer_record RECORD;
  total_cost NUMERIC;
  total_tickets INTEGER;
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
  
  -- Get offer details
  SELECT * INTO offer_record FROM product_offers WHERE id = p_offer_id AND status = 'active';
  
  IF offer_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'العرض غير متوفر');
  END IF;
  
  -- Check stock
  IF offer_record.stock_quantity IS NOT NULL AND offer_record.stock_quantity < p_quantity THEN
    RETURN jsonb_build_object('success', false, 'error', 'الكمية المطلوبة غير متوفرة');
  END IF;
  
  total_cost := offer_record.price * p_quantity;
  total_tickets := offer_record.gift_tickets * p_quantity;
  
  -- Check wallet balance
  SELECT balance INTO wallet_balance FROM user_wallets WHERE user_id = current_user_id;
  
  IF wallet_balance IS NULL OR wallet_balance < total_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'رصيد المحفظة غير كافٍ');
  END IF;
  
  -- Deduct from wallet
  UPDATE user_wallets
  SET balance = balance - total_cost, updated_at = now()
  WHERE user_id = current_user_id;
  
  -- Record wallet transaction
  INSERT INTO wallet_transactions (user_id, type, amount, status, admin_notes)
  VALUES (current_user_id, 'product_purchase', -total_cost, 'completed', 
          'شراء ' || p_quantity || ' من ' || offer_record.title_ar);
  
  -- Create purchase record
  INSERT INTO product_offer_purchases (
    user_id, offer_id, quantity, unit_price, total_price, gift_tickets_awarded
  ) VALUES (
    current_user_id, p_offer_id, p_quantity, offer_record.price, total_cost, total_tickets
  ) RETURNING id INTO new_purchase_id;
  
  -- Create user_purchased_products records for each item
  FOR i IN 1..p_quantity LOOP
    INSERT INTO user_purchased_products (
      user_id,
      product_id,
      product_name,
      product_name_ar,
      product_image,
      product_price,
      gift_tickets,
      source_type,
      order_status,
      currency
    ) VALUES (
      current_user_id,
      NULL,
      offer_record.title,
      offer_record.title_ar,
      offer_record.image_url,
      offer_record.price,
      offer_record.gift_tickets,
      'purchase',
      'not_ordered',
      COALESCE(offer_record.currency, 'دينار')
    );
  END LOOP;
  
  -- Update stock
  IF offer_record.stock_quantity IS NOT NULL THEN
    UPDATE product_offers
    SET stock_quantity = stock_quantity - p_quantity,
        total_sold = total_sold + p_quantity,
        updated_at = now()
    WHERE id = p_offer_id;
  ELSE
    UPDATE product_offers
    SET total_sold = total_sold + p_quantity,
        updated_at = now()
    WHERE id = p_offer_id;
  END IF;
  
  -- Add gift tickets to user
  INSERT INTO user_tickets (user_id, ticket_count)
  VALUES (current_user_id, total_tickets)
  ON CONFLICT (user_id) DO UPDATE
  SET ticket_count = user_tickets.ticket_count + total_tickets,
      updated_at = now();
  
  -- Send notification
  INSERT INTO notifications (user_id, title, message, type)
  VALUES (current_user_id, 'تم الشراء بنجاح! 🎁', 
          'تم شراء ' || p_quantity || ' ' || offer_record.title_ar || ' وحصلت على ' || total_tickets || ' تذكرة هدية',
          'success');
  
  RETURN jsonb_build_object(
    'success', true,
    'purchase_id', new_purchase_id,
    'total_cost', total_cost,
    'gift_tickets', total_tickets,
    'product_name', offer_record.title_ar
  );
END;
$function$;