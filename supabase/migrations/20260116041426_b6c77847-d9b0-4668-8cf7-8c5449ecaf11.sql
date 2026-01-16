-- 1. إصلاح دالة purchase_product_offer - منح التذاكر فقط إذا كانت gift_tickets > 0
CREATE OR REPLACE FUNCTION public.purchase_product_offer(p_offer_id UUID, p_quantity INTEGER DEFAULT 1)
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
  
  -- Only calculate tickets if gift_tickets > 0
  IF COALESCE(offer_record.gift_tickets, 0) > 0 THEN
    total_tickets := offer_record.gift_tickets * p_quantity;
  ELSE
    total_tickets := 0;
  END IF;
  
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
  
  -- Add gift tickets to user ONLY if total_tickets > 0
  IF total_tickets > 0 THEN
    INSERT INTO user_tickets (user_id, ticket_count)
    VALUES (current_user_id, total_tickets)
    ON CONFLICT (user_id) DO UPDATE
    SET ticket_count = user_tickets.ticket_count + total_tickets,
        updated_at = now();
  END IF;
  
  -- Send notification
  INSERT INTO notifications (user_id, title, message, type)
  VALUES (current_user_id, 'تم الشراء بنجاح! 🎁', 
          CASE 
            WHEN total_tickets > 0 THEN 'تم شراء ' || p_quantity || ' ' || offer_record.title_ar || ' وحصلت على ' || total_tickets || ' تذكرة هدية'
            ELSE 'تم شراء ' || p_quantity || ' ' || offer_record.title_ar || ' بنجاح'
          END,
          'success');
  
  RETURN jsonb_build_object(
    'success', true,
    'purchase_id', new_purchase_id,
    'total_cost', total_cost,
    'gift_tickets', total_tickets,
    'product_name', offer_record.title_ar
  );
END;
$$;

-- 2. إصلاح دالة award_points_on_delivery - التحقق من points_status
CREATE OR REPLACE FUNCTION public.award_points_on_delivery()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_points NUMERIC;
  order_multiplier NUMERIC;
  points_to_add NUMERIC;
  settings_data JSONB;
  points_enabled TEXT;
BEGIN
  IF OLD.status != 'delivered' AND NEW.status = 'delivered' THEN
    -- جلب الإعدادات
    SELECT setting_value INTO settings_data
    FROM default_settings
    WHERE setting_key = 'points_settings';

    -- التحقق من حالة نظام النقاط
    points_enabled := COALESCE(settings_data->>'points_status', 'disabled');
    
    -- إذا كان النظام معطل، لا نمنح نقاط
    IF points_enabled != 'enabled' THEN
      RETURN NEW;
    END IF;

    -- النقاط الأساسية
    base_points := COALESCE((settings_data->>'points_per_order')::NUMERIC, 10);
    
    -- معامل النقاط حسب قيمة الطلب
    order_multiplier := COALESCE((settings_data->>'order_value_multiplier')::NUMERIC, 0);
    
    -- حساب النقاط الإجمالية
    points_to_add := base_points + (NEW.total_amount * order_multiplier);
    
    -- إضافة النقاط للمستخدم
    INSERT INTO user_points (user_id, total_points, available_points)
    VALUES (NEW.user_id, points_to_add, points_to_add)
    ON CONFLICT (user_id) DO UPDATE
    SET 
      total_points = user_points.total_points + points_to_add,
      available_points = user_points.available_points + points_to_add,
      updated_at = now();

    -- إضافة معاملة
    INSERT INTO points_transactions (user_id, points, type, source, related_id, description)
    VALUES (
      NEW.user_id,
      points_to_add,
      'earned',
      'order',
      NEW.id,
      CASE 
        WHEN order_multiplier > 0 THEN
          'نقاط الشراء - طلب رقم: ' || NEW.order_number || ' (' || base_points || ' نقطة أساسية + ' || (NEW.total_amount * order_multiplier) || ' نقطة حسب قيمة الطلب)'
        ELSE
          'نقاط الشراء - طلب رقم: ' || NEW.order_number
      END
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 3. إصلاح دالة get_user_eligible_printers - جلب الرقم التسلسلي من admin_notes المعتمد
CREATE OR REPLACE FUNCTION public.get_user_eligible_printers(p_user_id UUID)
RETURNS TABLE (
  order_item_id UUID,
  order_id UUID,
  product_id UUID,
  product_name TEXT,
  product_name_ar TEXT,
  serial_number TEXT,
  delivered_at TIMESTAMP WITH TIME ZONE,
  is_registered BOOLEAN,
  user_printer_id UUID,
  has_active_subscription BOOLEAN,
  pending_serial_request BOOLEAN,
  image_url TEXT,
  is_verified BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    oi.id as order_item_id,
    oi.order_id,
    oi.product_id,
    oi.product_name,
    oi.product_name_ar,
    -- أولوية للرقم التسلسلي من order_items، ثم من طلب serial_number_requests المعتمد
    COALESCE(
      oi.serial_number,
      (SELECT snr.admin_notes FROM serial_number_requests snr 
       WHERE snr.order_item_id = oi.id AND snr.status = 'approved' 
       ORDER BY snr.updated_at DESC LIMIT 1)
    ) as serial_number,
    o.delivered_at,
    (up.id IS NOT NULL) as is_registered,
    up.id as user_printer_id,
    (ps.id IS NOT NULL AND ps.status = 'active') as has_active_subscription,
    -- التحقق من وجود طلب معلق
    EXISTS(SELECT 1 FROM serial_number_requests snr 
           WHERE snr.order_item_id = oi.id AND snr.status = 'pending') as pending_serial_request,
    COALESCE(sp.image_url, p.image_url) as image_url,
    -- التحقق من التأكيد (إما من order_items أو من طلب معتمد)
    (oi.serial_number IS NOT NULL OR EXISTS(
      SELECT 1 FROM serial_number_requests snr 
      WHERE snr.order_item_id = oi.id AND snr.status = 'approved'
    )) as is_verified
  FROM order_items oi
  INNER JOIN orders o ON o.id = oi.order_id
  LEFT JOIN products p ON p.id = oi.product_id
  LEFT JOIN store_printers sp ON sp.serial_number = COALESCE(
    oi.serial_number,
    (SELECT snr.admin_notes FROM serial_number_requests snr 
     WHERE snr.order_item_id = oi.id AND snr.status = 'approved' 
     ORDER BY snr.updated_at DESC LIMIT 1)
  )
  LEFT JOIN user_printers up ON up.store_printer_id = sp.id AND up.user_id = p_user_id
  LEFT JOIN printer_subscriptions ps ON ps.user_printer_id = up.id AND ps.status = 'active'
  WHERE o.user_id = p_user_id
    AND o.status = 'delivered'
    AND (
      oi.product_name_ar ILIKE '%طابع%'
      OR oi.product_name_ar ILIKE '%printer%'
      OR oi.product_name ILIKE '%printer%'
      OR oi.product_name ILIKE '%3d%'
    )
  ORDER BY o.delivered_at DESC;
END;
$$;