DROP VIEW IF EXISTS public.orders_admin;
CREATE VIEW public.orders_admin AS
SELECT id, user_id, order_number, status, total_amount, currency, shipping_address,
  phone_number, governorate, shipping_notes, created_at, updated_at, shipped_at,
  delivered_at, serial_number_image_url, arrived_warehouse_at, arrived_iraq_at,
  user_confirmed_delivery, user_confirmed_at, auto_confirmed, admin_images, admin_files,
  estimated_delivery_date, actual_weight, package_dimensions, customs_declaration_number,
  internal_notes, priority, payment_status, payment_method, subtotal, tax_amount,
  tax_percentage, discount_amount, paid_amount, remaining_amount, shipping_route_type,
  shipping_duration_days, shipping_route_waypoints, admin_product_cost, admin_shipping_cost,
  admin_other_costs, profit_amount, financial_notes, admin_paid_amount, customer_paid_amount,
  confirmed_at, processing_at, purchased_at, on_the_way_at, cancelled_at, order_type,
  stock_deducted, delivery_method, card_discount_amount, card_discount_level_name,
  referral_coupon_id, referral_owner_earnings_iqd, cod_fee,
  auto_donation_amount, extra_donation_amount
FROM public._admin_orders_full();

GRANT SELECT ON public.orders_admin TO authenticated;