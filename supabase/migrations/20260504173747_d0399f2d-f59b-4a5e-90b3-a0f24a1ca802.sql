-- products
REVOKE SELECT ON public.products FROM anon, authenticated;
GRANT SELECT (
  id, name, name_ar, name_en, name_ku, slug,
  description, description_ar, description_en, description_ku,
  price, original_price, category_id, image_url, in_stock, featured,
  created_at, updated_at, currency, images, colors, features,
  availability_type, pre_order_free_shipping_price, pre_order_fast_shipping_price,
  has_in_stock, has_pre_order, pre_order_shipping_options,
  taobao_url, taobao_variant_mapping, taobao_last_sync_at,
  taobao_sync_status, taobao_availability_cache,
  points_reward, card_discounts, ticket_reward,
  shipping_type, weight_kg, length_cm, width_cm, height_cm,
  is_pricing_updated,
  direct_sale_price, sea_price, air_price, round_up_price,
  sold_count, direct_stock, pre_order_stock, personal_delivery_cost,
  cod_enabled, cod_fee_type, cod_fee_value, link_direct_commission_to_cod,
  ai_content, short_summary, searchable_attributes
) ON public.products TO anon, authenticated;

-- delivery_methods
REVOKE SELECT ON public.delivery_methods FROM anon, authenticated;
GRANT SELECT (
  id, method_key, name_ar, name_en, name_ku,
  description_ar, description_en, description_ku,
  base_price, is_active, display_order, icon,
  base_price_category_id, base_price_units_per_delivery,
  free_delivery_enabled, free_delivery_min_order,
  created_at, updated_at
) ON public.delivery_methods TO anon, authenticated;

-- merchant_public_profiles (debt fields excluded; available via merchant_debt_self view for owner+admin)
REVOKE SELECT ON public.merchant_public_profiles FROM anon, authenticated;
GRANT SELECT (
  id, display_name, store_image_url, bio, city, social_links,
  created_at, updated_at, is_verified, badge_tier, selected_frame_id,
  specialty, store_layout, accepted_payment_methods,
  delivery_price_iqd, delivery_rules, store_slug,
  store_background_type, store_background_value, store_background_blur
) ON public.merchant_public_profiles TO anon, authenticated;

-- orders (admin financial/internal fields excluded; admins use orders_admin view)
REVOKE SELECT ON public.orders FROM anon, authenticated;
GRANT SELECT (
  id, user_id, order_number, status, total_amount, currency,
  shipping_address, phone_number, governorate, shipping_notes,
  created_at, updated_at, shipped_at, delivered_at,
  serial_number_image_url, arrived_warehouse_at, arrived_iraq_at,
  user_confirmed_delivery, user_confirmed_at, auto_confirmed,
  admin_images, admin_files, estimated_delivery_date,
  actual_weight, package_dimensions, customs_declaration_number,
  payment_status, payment_method, subtotal, tax_amount, tax_percentage,
  discount_amount, paid_amount, remaining_amount,
  shipping_route_type, shipping_duration_days, shipping_route_waypoints,
  admin_paid_amount, customer_paid_amount,
  confirmed_at, processing_at, purchased_at, on_the_way_at, cancelled_at,
  order_type, stock_deducted, delivery_method,
  card_discount_amount, card_discount_level_name,
  referral_coupon_id, referral_owner_earnings_iqd
) ON public.orders TO anon, authenticated;

-- order_items (cost_price excluded)
REVOKE SELECT ON public.order_items FROM anon, authenticated;
GRANT SELECT (
  id, order_id, product_id, product_option_id, product_name, product_name_ar,
  selected_option, selected_color, quantity, unit_price, total_price,
  created_at, shipping_option_name_ar, shipping_price_adjustment,
  color_image_url, custom_request_id, serial_number,
  customer_notes, bundle_id, is_gift
) ON public.order_items TO anon, authenticated;
