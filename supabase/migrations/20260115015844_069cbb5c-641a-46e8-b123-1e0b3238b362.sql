-- Add serial_number to order_items for printers
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS serial_number TEXT;

-- Create a view or function to get delivered printer items with serial numbers
CREATE OR REPLACE FUNCTION public.get_user_delivered_printers(p_user_id UUID)
RETURNS TABLE (
  order_item_id UUID,
  order_id UUID,
  product_id UUID,
  product_name TEXT,
  product_name_ar TEXT,
  serial_number TEXT,
  delivered_at TIMESTAMPTZ,
  is_registered BOOLEAN,
  user_printer_id UUID
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
    oi.serial_number,
    o.delivered_at,
    EXISTS(
      SELECT 1 FROM store_printers sp 
      JOIN user_printers up ON up.store_printer_id = sp.id 
      WHERE sp.serial_number = oi.serial_number 
      AND up.user_id = p_user_id
    ) as is_registered,
    (
      SELECT up.id FROM store_printers sp 
      JOIN user_printers up ON up.store_printer_id = sp.id 
      WHERE sp.serial_number = oi.serial_number 
      AND up.user_id = p_user_id
      LIMIT 1
    ) as user_printer_id
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE o.user_id = p_user_id
  AND o.status = 'delivered'
  AND oi.serial_number IS NOT NULL
  AND oi.serial_number != '';
END;
$$;

-- Function to auto-register printer from order item
CREATE OR REPLACE FUNCTION public.register_printer_from_order(
  p_user_id UUID,
  p_serial_number TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_printer_id UUID;
  v_user_printer_id UUID;
BEGIN
  -- Find the store printer
  SELECT id INTO v_store_printer_id
  FROM store_printers
  WHERE serial_number = p_serial_number;
  
  IF v_store_printer_id IS NULL THEN
    RAISE EXCEPTION 'الرقم التسلسلي غير موجود';
  END IF;
  
  -- Check if already registered
  SELECT id INTO v_user_printer_id
  FROM user_printers
  WHERE store_printer_id = v_store_printer_id;
  
  IF v_user_printer_id IS NOT NULL THEN
    RAISE EXCEPTION 'هذه الطابعة مسجلة مسبقاً';
  END IF;
  
  -- Register the printer
  INSERT INTO user_printers (user_id, store_printer_id, verification_status, verified_at)
  VALUES (p_user_id, v_store_printer_id, 'verified', NOW())
  RETURNING id INTO v_user_printer_id;
  
  -- Update store_printers
  UPDATE store_printers SET is_registered = true WHERE id = v_store_printer_id;
  
  -- Log the action
  INSERT INTO printer_protection_logs (user_id, action, entity_type, entity_id, details)
  VALUES (p_user_id, 'register_from_order', 'user_printer', v_user_printer_id, 
    jsonb_build_object('serial_number', p_serial_number));
  
  RETURN v_user_printer_id;
END;
$$;