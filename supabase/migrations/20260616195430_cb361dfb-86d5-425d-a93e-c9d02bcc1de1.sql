
DROP VIEW IF EXISTS public.products_admin;

CREATE VIEW public.products_admin
WITH (security_invoker = true)
AS
SELECT
  p.id, p.name, p.name_ar, p.slug, p.description, p.description_ar,
  p.price, p.original_price, p.category_id, p.image_url, p.in_stock, p.featured,
  p.created_at, p.updated_at, p.currency, p.images, p.colors, p.features,
  p.availability_type, p.pre_order_free_shipping_price, p.pre_order_fast_shipping_price,
  p.has_in_stock, p.has_pre_order, p.pre_order_shipping_options,
  CASE WHEN has_role(auth.uid(), 'admin'::app_role) THEN p.cost_price ELSE NULL::numeric END AS cost_price,
  p.taobao_url, p.taobao_variant_mapping, p.taobao_last_sync_at, p.taobao_sync_status, p.taobao_availability_cache,
  p.points_reward, p.card_discounts, p.ticket_reward,
  p.name_en, p.name_ku, p.description_en, p.description_ku, p.price_usd,
  p.shipping_type, p.weight_kg, p.length_cm, p.width_cm, p.height_cm,
  CASE WHEN has_role(auth.uid(), 'admin'::app_role) THEN p.shipping_cost_iqd ELSE NULL::numeric END AS shipping_cost_iqd,
  p.is_pricing_updated,
  CASE WHEN has_role(auth.uid(), 'admin'::app_role) THEN p.commission_iqd ELSE NULL::numeric END AS commission_iqd,
  CASE WHEN has_role(auth.uid(), 'admin'::app_role) THEN p.other_costs_iqd ELSE NULL::numeric END AS other_costs_iqd,
  CASE WHEN has_role(auth.uid(), 'admin'::app_role) THEN p.commission_sea_iqd ELSE NULL::numeric END AS commission_sea_iqd,
  CASE WHEN has_role(auth.uid(), 'admin'::app_role) THEN p.commission_air_iqd ELSE NULL::numeric END AS commission_air_iqd,
  CASE WHEN has_role(auth.uid(), 'admin'::app_role) THEN p.commission_direct_iqd ELSE NULL::numeric END AS commission_direct_iqd,
  p.original_price_usd, p.direct_sale_price, p.sea_price, p.air_price, p.round_up_price,
  p.sold_count, p.direct_stock, p.pre_order_stock,
  CASE WHEN has_role(auth.uid(), 'admin'::app_role) THEN p.personal_delivery_cost ELSE NULL::integer END AS personal_delivery_cost,
  CASE WHEN has_role(auth.uid(), 'admin'::app_role) THEN p.referral_earnings_iqd ELSE NULL::numeric END AS referral_earnings_iqd,
  p.cod_enabled, p.cod_fee_type, p.cod_fee_value, p.link_direct_commission_to_cod,
  p.ai_content, p.short_summary, p.searchable_attributes, p.display_order, p.brand,
  p.pending_admin_review,
  p.created_by_assistant
FROM public.products p
WHERE public.has_admin_access(auth.uid()) OR public.has_role(auth.uid(), 'assistant'::app_role);

GRANT SELECT ON public.products_admin TO authenticated;
