-- Fix the request_product_delivery function with better error handling
CREATE OR REPLACE FUNCTION public.request_product_delivery(
  p_product_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id UUID;
  product_count INTEGER;
  new_shipment_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'غير مصرح');
  END IF;

  -- Check if products exist and belong to user
  SELECT COUNT(*) INTO product_count
  FROM user_purchased_products
  WHERE id = ANY(p_product_ids)
    AND user_id = current_user_id
    AND order_status = 'not_ordered'
    AND (listed_in_marketplace IS NULL OR listed_in_marketplace = false);

  IF product_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'لا توجد منتجات مؤهلة للشحن. تأكد من أن المنتجات لم تُطلب مسبقاً وليست معروضة في السوق.');
  END IF;

  -- Create shipment request
  INSERT INTO shipment_requests (user_id, total_items)
  VALUES (current_user_id, product_count)
  RETURNING id INTO new_shipment_id;

  -- Update products status
  UPDATE user_purchased_products
  SET order_status = 'ordered',
      ordered_at = now(),
      updated_at = now(),
      shipment_request_id = new_shipment_id
  WHERE id = ANY(p_product_ids)
    AND user_id = current_user_id
    AND order_status = 'not_ordered'
    AND (listed_in_marketplace IS NULL OR listed_in_marketplace = false);

  GET DIAGNOSTICS product_count = ROW_COUNT;

  -- Send notification
  INSERT INTO notifications (user_id, title, message, type, related_id)
  VALUES (
    current_user_id,
    'تم تسجيل طلب الشحن',
    'تم تسجيل طلب شحن ' || product_count || ' منتج. سيتم التواصل معك قريباً.',
    'shipment',
    new_shipment_id::text
  );

  RETURN jsonb_build_object(
    'success', true,
    'products_ordered', product_count,
    'shipment_id', new_shipment_id,
    'message', 'تم تسجيل طلب الشحن بنجاح لـ ' || product_count || ' منتج'
  );
END;
$$;

-- Fix request_offer_shipment to use user_purchased_products table
CREATE OR REPLACE FUNCTION public.request_offer_shipment(
  p_purchase_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id UUID;
  updated_count INTEGER;
  new_shipment_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'غير مصرح');
  END IF;
  
  -- Check if products exist and belong to user
  SELECT COUNT(*) INTO updated_count
  FROM user_purchased_products
  WHERE id = ANY(p_purchase_ids)
    AND user_id = current_user_id
    AND order_status = 'not_ordered'
    AND (listed_in_marketplace IS NULL OR listed_in_marketplace = false);

  IF updated_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'لا توجد منتجات مؤهلة للشحن. تأكد من أن المنتجات لم تُطلب مسبقاً.');
  END IF;

  -- Create shipment request
  INSERT INTO shipment_requests (user_id, total_items)
  VALUES (current_user_id, updated_count)
  RETURNING id INTO new_shipment_id;
  
  -- Update user_purchased_products
  UPDATE user_purchased_products
  SET order_status = 'ordered',
      ordered_at = now(),
      updated_at = now(),
      shipment_request_id = new_shipment_id
  WHERE id = ANY(p_purchase_ids)
    AND user_id = current_user_id
    AND order_status = 'not_ordered'
    AND (listed_in_marketplace IS NULL OR listed_in_marketplace = false);
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;

  -- Send notification
  INSERT INTO notifications (user_id, title, message, type, related_id)
  VALUES (
    current_user_id,
    'تم تسجيل طلب الشحن',
    'تم تسجيل طلب شحن ' || updated_count || ' منتج. سيتم التواصل معك قريباً.',
    'shipment',
    new_shipment_id::text
  );
  
  RETURN jsonb_build_object(
    'success', true, 
    'message', 'تم طلب شحن ' || updated_count || ' منتج بنجاح',
    'shipment_id', new_shipment_id,
    'products_count', updated_count
  );
END;
$$;