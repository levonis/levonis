-- Restore SELECT on order_items for authenticated users (excluding cost_price which is admin-only)
GRANT SELECT (id, order_id, product_id, product_option_id, product_name, product_name_ar,
  selected_option, selected_color, quantity, unit_price, total_price, created_at,
  shipping_option_name_ar, shipping_price_adjustment, color_image_url, custom_request_id,
  serial_number, customer_notes, bundle_id, is_gift, rf_offer_id)
ON public.order_items TO authenticated;

-- Allow users to insert their own order items (RLS still enforces ownership via order)
GRANT INSERT ON public.order_items TO authenticated;

-- Ensure anon has no access
REVOKE ALL ON public.order_items FROM anon;