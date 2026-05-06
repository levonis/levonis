CREATE OR REPLACE VIEW public.products_admin
WITH (security_invoker = true) AS
SELECT id, name, name_ar, slug, description, description_ar, price, original_price,
  category_id, image_url, in_stock, featured, created_at, updated_at, currency, images,
  colors, features, availability_type, pre_order_free_shipping_price, pre_order_fast_shipping_price,
  has_in_stock, has_pre_order, pre_order_shipping_options, cost_price, taobao_url,
  taobao_variant_mapping, taobao_last_sync_at, taobao_sync_status, taobao_availability_cache,
  points_reward, card_discounts, ticket_reward, name_en, name_ku, description_en, description_ku,
  price_usd, shipping_type, weight_kg, length_cm, width_cm, height_cm, shipping_cost_iqd,
  is_pricing_updated, commission_iqd, other_costs_iqd, commission_sea_iqd, commission_air_iqd,
  commission_direct_iqd, original_price_usd, direct_sale_price, sea_price, air_price,
  round_up_price, sold_count, direct_stock, pre_order_stock, personal_delivery_cost,
  referral_earnings_iqd, cod_enabled, cod_fee_type, cod_fee_value,
  link_direct_commission_to_cod, ai_content, short_summary, searchable_attributes,
  display_order, brand
FROM products
WHERE has_role(auth.uid(), 'admin'::app_role);

GRANT SELECT ON public.products_admin TO authenticated;