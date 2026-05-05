
-- Restore authenticated grants on public.orders for all non-sensitive columns.
-- Sensitive cost/profit/admin fields remain hidden (admins use orders_admin view).

-- SELECT: allow authenticated to read non-cost columns (RLS still applies)
GRANT SELECT (
  id, user_id, order_number, status, payment_status, payment_method,
  delivery_method, subtotal, total_amount, discount_amount, tax_amount,
  tax_percentage, paid_amount, remaining_amount, customer_paid_amount,
  card_discount_amount, card_discount_level_name, currency, governorate,
  phone_number, shipping_address, shipping_notes, shipping_duration_days,
  shipping_route_type, shipping_route_waypoints, estimated_delivery_date,
  package_dimensions, actual_weight, customs_declaration_number,
  serial_number_image_url, order_type, priority, stock_deducted,
  auto_confirmed, user_confirmed_delivery, user_confirmed_at,
  referral_coupon_id, referral_owner_earnings_iqd,
  purchased_at, confirmed_at, processing_at, shipped_at, on_the_way_at,
  arrived_warehouse_at, arrived_iraq_at, delivered_at, cancelled_at,
  created_at, updated_at
) ON public.orders TO authenticated;

-- INSERT: allow authenticated to create their own orders on non-sensitive columns
GRANT INSERT (
  id, user_id, order_number, status, payment_status, payment_method,
  delivery_method, subtotal, total_amount, discount_amount, tax_amount,
  tax_percentage, paid_amount, remaining_amount, customer_paid_amount,
  card_discount_amount, card_discount_level_name, currency, governorate,
  phone_number, shipping_address, shipping_notes, shipping_duration_days,
  shipping_route_type, shipping_route_waypoints, estimated_delivery_date,
  package_dimensions, order_type, priority,
  user_confirmed_delivery, user_confirmed_at,
  referral_coupon_id, referral_owner_earnings_iqd,
  purchased_at, created_at, updated_at
) ON public.orders TO authenticated;

-- UPDATE: allow authenticated to update only confirmation fields on their own orders (RLS enforces ownership)
GRANT UPDATE (
  user_confirmed_delivery, user_confirmed_at, status, updated_at
) ON public.orders TO authenticated;
