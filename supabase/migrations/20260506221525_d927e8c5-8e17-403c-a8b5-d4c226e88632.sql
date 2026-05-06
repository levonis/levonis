-- Restore SELECT on products for anon/authenticated on all non-sensitive columns.
-- Cost/commission/shipping_cost/price_usd/original_price_usd/referral_earnings_iqd remain hidden.
GRANT SELECT (
  id, name, name_ar, slug, description, description_ar,
  price, original_price, category_id, image_url, in_stock, featured,
  created_at, updated_at, currency, images, colors, features,
  availability_type, pre_order_free_shipping_price, pre_order_fast_shipping_price,
  has_in_stock, has_pre_order, pre_order_shipping_options,
  taobao_url, taobao_variant_mapping, taobao_last_sync_at, taobao_sync_status, taobao_availability_cache,
  points_reward, card_discounts, ticket_reward,
  name_en, name_ku, description_en, description_ku,
  shipping_type, weight_kg, length_cm, width_cm, height_cm,
  is_pricing_updated,
  direct_sale_price, sea_price, air_price, round_up_price,
  sold_count, direct_stock, pre_order_stock, personal_delivery_cost,
  cod_enabled, cod_fee_type, cod_fee_value, link_direct_commission_to_cod,
  ai_content, short_summary, searchable_attributes,
  display_order, brand
) ON public.products TO anon, authenticated;