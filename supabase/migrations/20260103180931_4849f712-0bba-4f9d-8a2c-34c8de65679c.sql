-- Drop and recreate the request_offer_shipment function
DROP FUNCTION IF EXISTS public.request_offer_shipment(uuid[]);

CREATE FUNCTION public.request_offer_shipment(p_purchase_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_shipment_id uuid;
  v_default_address record;
  v_product_count int;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'يجب تسجيل الدخول');
  END IF;

  -- Validate products belong to user and are not_ordered
  SELECT COUNT(*) INTO v_product_count
  FROM user_purchased_products
  WHERE id = ANY(p_purchase_ids)
    AND user_id = v_user_id
    AND order_status = 'not_ordered';
    
  IF v_product_count = 0 OR v_product_count != array_length(p_purchase_ids, 1) THEN
    RETURN jsonb_build_object('success', false, 'error', 'بعض المنتجات غير متاحة للشحن');
  END IF;
  
  -- Get default address
  SELECT * INTO v_default_address
  FROM user_addresses
  WHERE user_id = v_user_id
  ORDER BY is_default DESC, created_at DESC
  LIMIT 1;
  
  IF v_default_address IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'يرجى إضافة عنوان توصيل أولاً');
  END IF;
  
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
    v_default_address.area || ' - ' || COALESCE(v_default_address.nearest_landmark, ''),
    v_default_address.governorate,
    v_default_address.phone_number
  )
  RETURNING id INTO v_shipment_id;
  
  -- Create shipment request items
  INSERT INTO shipment_request_items (shipment_request_id, purchased_product_id, quantity)
  SELECT v_shipment_id, id, 1
  FROM user_purchased_products
  WHERE id = ANY(p_purchase_ids);
  
  -- Update purchased products status to 'ordered' (correct value for check constraint)
  UPDATE user_purchased_products
  SET 
    order_status = 'ordered',
    ordered_at = now(),
    shipment_request_id = v_shipment_id,
    updated_at = now()
  WHERE id = ANY(p_purchase_ids);
  
  RETURN jsonb_build_object(
    'success', true, 
    'message', 'تم طلب الشحن بنجاح! سيتم التواصل معك قريباً',
    'shipment_id', v_shipment_id
  );
END;
$$;