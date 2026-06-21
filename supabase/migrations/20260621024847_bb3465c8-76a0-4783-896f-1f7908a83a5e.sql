DROP VIEW IF EXISTS public.products_admin;

CREATE VIEW public.products_admin
WITH (security_invoker=on) AS
SELECT id, name, name_ar, slug, description, description_ar, price, original_price, category_id, image_url, in_stock, featured, created_at, updated_at, currency, images, colors, features, availability_type, pre_order_free_shipping_price, pre_order_fast_shipping_price, has_in_stock, has_pre_order, pre_order_shipping_options,
  CASE WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'assistant'::app_role) THEN cost_price ELSE NULL::numeric END AS cost_price,
  taobao_url, taobao_variant_mapping, taobao_last_sync_at, taobao_sync_status, taobao_availability_cache, points_reward, card_discounts, ticket_reward, name_en, name_ku, description_en, description_ku, price_usd, shipping_type, weight_kg, length_cm, width_cm, height_cm,
  CASE WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'assistant'::app_role) THEN shipping_cost_iqd ELSE NULL::numeric END AS shipping_cost_iqd,
  is_pricing_updated,
  CASE WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'assistant'::app_role) THEN commission_iqd ELSE NULL::numeric END AS commission_iqd,
  CASE WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'assistant'::app_role) THEN other_costs_iqd ELSE NULL::numeric END AS other_costs_iqd,
  CASE WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'assistant'::app_role) THEN commission_sea_iqd ELSE NULL::numeric END AS commission_sea_iqd,
  CASE WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'assistant'::app_role) THEN commission_air_iqd ELSE NULL::numeric END AS commission_air_iqd,
  CASE WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'assistant'::app_role) THEN commission_land_iqd ELSE NULL::numeric END AS commission_land_iqd,
  CASE WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'assistant'::app_role) THEN commission_direct_iqd ELSE NULL::numeric END AS commission_direct_iqd,
  original_price_usd, direct_sale_price, sea_price, air_price, land_price, round_up_price, sold_count, direct_stock, pre_order_stock,
  CASE WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'assistant'::app_role) THEN personal_delivery_cost ELSE NULL::integer END AS personal_delivery_cost,
  CASE WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'assistant'::app_role) THEN referral_earnings_iqd ELSE NULL::numeric END AS referral_earnings_iqd,
  cod_enabled, cod_fee_type, cod_fee_value, link_direct_commission_to_cod, ai_content, short_summary, searchable_attributes, display_order, brand, pending_admin_review, created_by_assistant
FROM public._admin_products_full() p;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.products_admin TO authenticated;
GRANT ALL ON public.products_admin TO service_role;