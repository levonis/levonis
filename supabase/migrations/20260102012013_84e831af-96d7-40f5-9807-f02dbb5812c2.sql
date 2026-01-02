-- First drop the old function, then recreate with correct return type
DROP FUNCTION IF EXISTS public.request_offer_shipment(uuid[]);

-- Recreate the function
CREATE OR REPLACE FUNCTION public.request_offer_shipment(p_purchase_ids uuid[])
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_shipment_id uuid;
  v_count int := 0;
  v_user_profile RECORD;
  v_default_address RECORD;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'يجب تسجيل الدخول');
  END IF;
  
  IF p_purchase_ids IS NULL OR array_length(p_purchase_ids, 1) = 0 THEN
    RETURN json_build_object('success', false, 'error', 'يرجى اختيار منتج واحد على الأقل');
  END IF;
  
  -- Verify all products belong to user and are eligible for shipping
  SELECT COUNT(*) INTO v_count
  FROM user_purchased_products
  WHERE id = ANY(p_purchase_ids)
    AND user_id = v_user_id
    AND order_status = 'not_ordered';
    
  IF v_count != array_length(p_purchase_ids, 1) THEN
    RETURN json_build_object('success', false, 'error', 'بعض المنتجات غير متاحة للشحن أو لا تنتمي لحسابك');
  END IF;
  
  -- Get user default address
  SELECT * INTO v_default_address
  FROM user_addresses
  WHERE user_id = v_user_id AND is_default = true
  LIMIT 1;
  
  -- Get user profile
  SELECT * INTO v_user_profile
  FROM profiles
  WHERE id = v_user_id;
  
  -- Create shipment request
  INSERT INTO shipment_requests (
    user_id,
    status,
    shipping_address,
    governorate,
    phone_number
  ) VALUES (
    v_user_id,
    'pending',
    COALESCE(v_default_address.area || ' - ' || v_default_address.nearest_landmark, 'لم يحدد'),
    COALESCE(v_default_address.governorate, v_user_profile.governorate, 'لم يحدد'),
    COALESCE(v_default_address.phone_number, v_user_profile.phone_number, '')
  ) RETURNING id INTO v_shipment_id;
  
  -- Add items to shipment
  INSERT INTO shipment_request_items (shipment_request_id, purchased_product_id, quantity)
  SELECT v_shipment_id, id, 1
  FROM user_purchased_products
  WHERE id = ANY(p_purchase_ids);
  
  -- Update products status
  UPDATE user_purchased_products
  SET order_status = 'pending',
      shipment_request_id = v_shipment_id,
      ordered_at = now(),
      updated_at = now()
  WHERE id = ANY(p_purchase_ids);
  
  -- Create notification
  INSERT INTO notifications (user_id, title, message, type)
  VALUES (
    v_user_id,
    'تم طلب الشحن بنجاح',
    'تم استلام طلب الشحن الخاص بك وسيتم معالجته قريباً',
    'info'
  );
  
  RETURN json_build_object(
    'success', true,
    'message', 'تم طلب الشحن بنجاح',
    'shipment_id', v_shipment_id,
    'items_count', array_length(p_purchase_ids, 1)
  );
END;
$$;

-- Add settings for tickets from purchases and points conversion
INSERT INTO default_settings (setting_key, setting_value)
VALUES 
  ('tickets_from_purchases', '{"enabled": true, "amount_per_ticket": 25000, "description": "تحصل على تذكرة واحدة مقابل كل 25,000 دينار"}'),
  ('points_to_tickets', '{"enabled": true, "points_per_ticket": 100, "description": "يمكنك تحويل 100 نقطة إلى تذكرة واحدة"}')
ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value;