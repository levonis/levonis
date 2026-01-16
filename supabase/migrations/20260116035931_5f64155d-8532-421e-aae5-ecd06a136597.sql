-- Fix 1: Update get_user_eligible_printers to check approved serial requests
CREATE OR REPLACE FUNCTION public.get_user_eligible_printers(p_user_id UUID)
RETURNS TABLE (
  order_item_id UUID,
  order_id UUID,
  product_id UUID,
  product_name TEXT,
  product_name_ar TEXT,
  serial_number TEXT,
  delivered_at TIMESTAMPTZ,
  is_registered BOOLEAN,
  user_printer_id UUID,
  has_active_subscription BOOLEAN,
  pending_serial_request BOOLEAN,
  image_url TEXT,
  is_verified BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    oi.id as order_item_id,
    oi.order_id,
    oi.product_id,
    oi.product_name,
    oi.product_name_ar,
    -- Get serial from order_items OR from approved serial_number_request
    COALESCE(oi.serial_number, approved_snr.approved_serial) as serial_number,
    o.delivered_at,
    (up.id IS NOT NULL) as is_registered,
    up.id as user_printer_id,
    (ps.id IS NOT NULL AND ps.status = 'active') as has_active_subscription,
    (pending_snr.id IS NOT NULL) as pending_serial_request,
    COALESCE(sp.image_url, p.image_url) as image_url,
    -- Verified if has serial from order_items OR from approved request
    (oi.serial_number IS NOT NULL OR approved_snr.approved_serial IS NOT NULL) as is_verified
  FROM order_items oi
  INNER JOIN orders o ON o.id = oi.order_id
  LEFT JOIN products p ON p.id = oi.product_id
  -- Check for approved serial_number_requests
  LEFT JOIN LATERAL (
    SELECT snr.admin_notes as approved_serial
    FROM serial_number_requests snr
    WHERE snr.order_item_id = oi.id AND snr.status = 'approved'
    ORDER BY snr.updated_at DESC
    LIMIT 1
  ) approved_snr ON TRUE
  -- Check for pending serial_number_requests
  LEFT JOIN LATERAL (
    SELECT snr.id
    FROM serial_number_requests snr
    WHERE snr.order_item_id = oi.id AND snr.status = 'pending'
    LIMIT 1
  ) pending_snr ON TRUE
  -- Get store printer using either serial from order_items or approved request
  LEFT JOIN store_printers sp ON sp.serial_number = COALESCE(oi.serial_number, approved_snr.approved_serial)
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix 2: Update purchase_product_with_gift_tickets to only give tickets if > 0
CREATE OR REPLACE FUNCTION public.purchase_product_with_gift_tickets(p_competition_id UUID, p_quantity INTEGER DEFAULT 1)
RETURNS JSONB AS $$
DECLARE
  current_user_id UUID;
  comp_record RECORD;
  product_record RECORD;
  user_wallet_balance NUMERIC;
  total_cost NUMERIC;
  total_gift_tickets INTEGER;
  new_purchased_product_id UUID;
  i INTEGER;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'غير مصرح');
  END IF;

  IF p_quantity < 1 OR p_quantity > 100 THEN
    RETURN jsonb_build_object('success', false, 'error', 'الكمية يجب أن تكون بين 1 و 100');
  END IF;

  -- جلب بيانات المسابقة/المنتج
  SELECT * INTO comp_record
  FROM competitions
  WHERE id = p_competition_id AND status = 'active';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'المنتج غير متاح');
  END IF;

  -- جلب بيانات المنتج المرتبط
  IF comp_record.product_id IS NOT NULL THEN
    SELECT * INTO product_record FROM products WHERE id = comp_record.product_id;
  END IF;

  -- حساب التكلفة الإجمالية
  total_cost := comp_record.ticket_price * p_quantity;
  
  -- FIXED: Only give gift tickets if gift_tickets_per_purchase is greater than 0
  IF COALESCE(comp_record.gift_tickets_per_purchase, 0) > 0 THEN
    total_gift_tickets := comp_record.gift_tickets_per_purchase * p_quantity;
  ELSE
    total_gift_tickets := 0;
  END IF;

  -- التحقق من رصيد المحفظة
  SELECT balance INTO user_wallet_balance
  FROM user_wallets
  WHERE user_id = current_user_id;
  
  IF user_wallet_balance IS NULL OR user_wallet_balance < total_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'رصيد المحفظة غير كافٍ. المطلوب: ' || total_cost);
  END IF;

  -- خصم من المحفظة
  UPDATE user_wallets
  SET balance = balance - total_cost,
      updated_at = now()
  WHERE user_id = current_user_id;
  
  -- تسجيل معاملة المحفظة
  INSERT INTO wallet_transactions (user_id, type, amount, status)
  VALUES (current_user_id, 'product_purchase', -total_cost, 'completed');

  -- إضافة المنتجات المشتراة
  FOR i IN 1..p_quantity LOOP
    INSERT INTO user_purchased_products (
      user_id,
      product_id,
      competition_id,
      product_name,
      product_name_ar,
      product_image,
      product_price,
      gift_tickets,
      source_type,
      currency
    )
    VALUES (
      current_user_id,
      comp_record.product_id,
      p_competition_id,
      COALESCE(product_record.name, comp_record.title),
      COALESCE(product_record.name_ar, comp_record.title_ar),
      COALESCE(product_record.image_url, comp_record.image_url),
      comp_record.ticket_price,
      CASE WHEN total_gift_tickets > 0 THEN COALESCE(comp_record.gift_tickets_per_purchase, 0) ELSE 0 END,
      'purchase',
      comp_record.currency
    )
    RETURNING id INTO new_purchased_product_id;
  END LOOP;

  -- FIXED: Only add tickets if there are any to add
  IF total_gift_tickets > 0 THEN
    INSERT INTO user_tickets (user_id, ticket_count)
    VALUES (current_user_id, total_gift_tickets)
    ON CONFLICT (user_id) DO UPDATE
    SET ticket_count = user_tickets.ticket_count + total_gift_tickets,
        updated_at = now();
  END IF;

  -- إرسال إشعار
  INSERT INTO notifications (user_id, title, message, type, related_id)
  VALUES (
    current_user_id,
    'تم شراء المنتج بنجاح! 🎁',
    CASE 
      WHEN total_gift_tickets > 0 THEN 'تم شراء ' || p_quantity || ' منتج وحصلت على ' || total_gift_tickets || ' تذكرة هدية مجانية!'
      ELSE 'تم شراء ' || p_quantity || ' منتج بنجاح!'
    END,
    'success',
    p_competition_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'quantity', p_quantity,
    'total_cost', total_cost,
    'gift_tickets', total_gift_tickets,
    'message', 'تم الشراء بنجاح!'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;