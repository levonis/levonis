-- Drop and recreate the function with new columns
DROP FUNCTION IF EXISTS get_user_eligible_printers(uuid);

CREATE FUNCTION get_user_eligible_printers(p_user_id uuid)
RETURNS TABLE (
  order_item_id uuid,
  order_id uuid,
  product_id uuid,
  product_name text,
  product_name_ar text,
  serial_number text,
  delivered_at timestamptz,
  is_registered boolean,
  user_printer_id uuid,
  has_active_subscription boolean,
  pending_serial_request boolean,
  image_url text,
  is_verified boolean
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
    (up.id IS NOT NULL) as is_registered,
    up.id as user_printer_id,
    (ps.id IS NOT NULL AND ps.status = 'active') as has_active_subscription,
    (snr.id IS NOT NULL AND snr.status = 'pending') as pending_serial_request,
    COALESCE(sp.image_url, p.image_url) as image_url,
    (oi.serial_number IS NOT NULL) as is_verified
  FROM order_items oi
  INNER JOIN orders o ON o.id = oi.order_id
  LEFT JOIN products p ON p.id = oi.product_id
  LEFT JOIN store_printers sp ON sp.serial_number = oi.serial_number
  LEFT JOIN user_printers up ON up.store_printer_id = sp.id AND up.user_id = p_user_id
  LEFT JOIN printer_subscriptions ps ON ps.user_printer_id = up.id AND ps.status = 'active'
  LEFT JOIN serial_number_requests snr ON snr.order_item_id = oi.id AND snr.status = 'pending'
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