-- إزالة صلاحية INSERT المباشر وتقييدها فقط للـ RPC
DROP POLICY IF EXISTS "Users can insert own purchases" ON public.product_offer_purchases;
DROP POLICY IF EXISTS "Require auth for purchases" ON public.product_offer_purchases;

-- السماح بالقراءة فقط للمستخدمين العاديين
CREATE POLICY "Users can only read own purchases"
ON public.product_offer_purchases
FOR SELECT
USING (auth.uid() = user_id);

-- السماح بالتحديث فقط لحالة طلب الشحن
CREATE POLICY "Users can request shipping for purchases"
ON public.product_offer_purchases
FOR UPDATE
USING (auth.uid() = user_id AND purchase_status IN ('pending', 'purchased'))
WITH CHECK (auth.uid() = user_id AND purchase_status IN ('pending', 'purchased', 'shipping_requested'));

-- الأدمن يمكنه إدارة كل شيء
-- السياسة موجودة بالفعل: "Admins can manage all purchases"

-- تحديث RPC لإضافة دعم النقاط
CREATE OR REPLACE FUNCTION public.purchase_product_offer(
  p_offer_id UUID,
  p_quantity INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID;
  offer_record RECORD;
  total_cost NUMERIC;
  total_tickets INTEGER;
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
  
  -- قفل لمنع العمليات المتزامنة
  PERFORM pg_advisory_xact_lock(hashtext('purchase_offer_' || current_user_id::text));
  
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
  total_tickets := COALESCE(offer_record.gift_tickets, 0) * p_quantity;
  total_points := COALESCE(offer_record.points_reward, 0) * p_quantity;
  
  -- Check wallet balance with FOR UPDATE lock
  SELECT balance INTO wallet_balance 
  FROM user_wallets 
  WHERE user_id = current_user_id
  FOR UPDATE;
  
  IF wallet_balance IS NULL OR wallet_balance < total_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'رصيد المحفظة غير كافٍ. الرصيد الحالي: ' || COALESCE(wallet_balance, 0)::TEXT || ' والمطلوب: ' || total_cost::TEXT);
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
      COALESCE(offer_record.gift_tickets, 0),
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
  
  -- Add gift tickets if any
  IF total_tickets > 0 THEN
    INSERT INTO user_tickets (user_id, ticket_count)
    VALUES (current_user_id, total_tickets)
    ON CONFLICT (user_id) DO UPDATE
    SET ticket_count = user_tickets.ticket_count + total_tickets,
        updated_at = now();
  END IF;
  
  -- Add points if any
  IF total_points > 0 THEN
    INSERT INTO points_transactions (user_id, points, type, source, description)
    VALUES (current_user_id, total_points, 'earn', 'offer_purchase', 
            'نقاط من شراء ' || offer_record.title_ar);
    
    -- Update available points
    INSERT INTO user_points (user_id, available_points, total_earned)
    VALUES (current_user_id, total_points, total_points)
    ON CONFLICT (user_id) DO UPDATE
    SET available_points = user_points.available_points + total_points,
        total_earned = user_points.total_earned + total_points,
        updated_at = now();
  END IF;
  
  -- Send notification
  INSERT INTO notifications (user_id, title, message, type)
  VALUES (current_user_id, 'تم الشراء بنجاح! 🎁', 
          CASE 
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
    'points_awarded', total_points,
    'product_name', offer_record.title_ar
  );
END;
$$;