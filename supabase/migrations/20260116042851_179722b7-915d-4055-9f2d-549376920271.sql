-- 1. Add unique constraint to prevent duplicate serial number requests for same order_item
ALTER TABLE serial_number_requests 
DROP CONSTRAINT IF EXISTS serial_number_requests_order_item_unique;

ALTER TABLE serial_number_requests 
ADD CONSTRAINT serial_number_requests_order_item_unique 
UNIQUE (order_item_id, user_id);

-- 2. Create function to properly add serial number and sync with requests
CREATE OR REPLACE FUNCTION public.add_serial_number_to_order_item(
  p_order_item_id UUID,
  p_serial_number TEXT,
  p_admin_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_name_ar TEXT;
  v_existing_serial TEXT;
  v_result JSONB;
BEGIN
  -- Get current serial and product name
  SELECT serial_number, product_name_ar INTO v_existing_serial, v_product_name_ar
  FROM order_items
  WHERE id = p_order_item_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order item not found');
  END IF;
  
  -- Update order_items with serial number
  UPDATE order_items
  SET serial_number = p_serial_number
  WHERE id = p_order_item_id;
  
  -- Create or update store_printer
  INSERT INTO store_printers (serial_number, model_name, model_name_ar, order_item_id)
  VALUES (p_serial_number, v_product_name_ar, v_product_name_ar, p_order_item_id)
  ON CONFLICT (serial_number) DO UPDATE
  SET order_item_id = p_order_item_id,
      model_name_ar = COALESCE(store_printers.model_name_ar, v_product_name_ar);
  
  -- Update any pending serial number requests for this order item
  UPDATE serial_number_requests
  SET status = 'approved',
      admin_notes = COALESCE(admin_notes, '') || ' | الرقم التسلسلي: ' || p_serial_number,
      resolved_at = NOW(),
      resolved_by = p_admin_id
  WHERE order_item_id = p_order_item_id
    AND status = 'pending';
  
  -- Log the action with proper details
  INSERT INTO printer_protection_logs (admin_id, action, entity_type, entity_id, details)
  VALUES (
    p_admin_id,
    'add_serial_number',
    'order_item',
    p_order_item_id,
    jsonb_build_object(
      'serial_number', p_serial_number,
      'product_name_ar', v_product_name_ar,
      'previous_serial', v_existing_serial
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'serial_number', p_serial_number,
    'product_name_ar', v_product_name_ar
  );
END;
$$;

-- 3. Update get_user_eligible_printers to check order_items.serial_number correctly
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
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    oi.id AS order_item_id,
    oi.order_id,
    oi.product_id,
    oi.product_name,
    oi.product_name_ar,
    COALESCE(oi.serial_number, sp.serial_number) AS serial_number,
    o.delivered_at,
    (up.id IS NOT NULL) AS is_registered,
    up.id AS user_printer_id,
    (ps.id IS NOT NULL AND ps.status = 'active') AS has_active_subscription,
    (snr.id IS NOT NULL AND snr.status = 'pending') AS pending_serial_request,
    p.image_url,
    COALESCE(oi.serial_number IS NOT NULL, sp.serial_number IS NOT NULL, false) AS is_verified
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  LEFT JOIN products p ON p.id = oi.product_id
  LEFT JOIN store_printers sp ON sp.order_item_id = oi.id OR sp.serial_number = oi.serial_number
  LEFT JOIN user_printers up ON up.store_printer_id = sp.id AND up.user_id = p_user_id
  LEFT JOIN printer_subscriptions ps ON ps.user_printer_id = up.id AND ps.status = 'active'
  LEFT JOIN serial_number_requests snr ON snr.order_item_id = oi.id AND snr.status = 'pending'
  WHERE o.user_id = p_user_id
    AND o.status = 'delivered'
    AND EXISTS (
      SELECT 1 FROM categories c 
      WHERE c.id = p.category_id 
      AND (c.name ILIKE '%printer%' OR c.name_ar ILIKE '%طابع%' OR c.slug ILIKE '%printer%')
    )
  ORDER BY o.delivered_at DESC;
END;
$$;