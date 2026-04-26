-- Re-sync direct_sale_price and commission_direct_iqd for products linked to COD,
-- now using the per-amount COD tiers (fee_tiers[].cod_fee_value) instead of the
-- legacy global default (cod_default_fee_value).

WITH settings AS (
  SELECT
    (SELECT setting_value FROM shipping_settings WHERE setting_key = 'usd_to_iqd_rate')::numeric AS rate,
    (SELECT setting_value FROM default_settings WHERE setting_key = 'partial_payment_settings') AS pp
),
calc AS (
  SELECT
    p.id,
    p.round_up_price,
    -- Base IQD price
    ROUND((p.price_usd * s.rate))::numeric AS price_iqd,
    COALESCE(p.shipping_cost_iqd, 0)::numeric AS shipping_cost,
    COALESCE(p.personal_delivery_cost, 0)::numeric AS pdc,
    COALESCE(p.referral_earnings_iqd, 0)::numeric AS referral,
    -- Pre-order commission addon (sea preferred, else air-only)
    CASE
      WHEN p.has_pre_order AND p.shipping_type IN ('sea','both') THEN COALESCE(p.commission_sea_iqd, 0)
      WHEN p.has_pre_order AND p.shipping_type = 'air' THEN COALESCE(p.commission_air_iqd, 0)
      ELSE 0
    END::numeric AS commission_addon,
    s.pp AS pp
  FROM products p, settings s
  WHERE p.link_direct_commission_to_cod = true
    AND p.price_usd > 0
    AND s.rate > 0
),
preorder AS (
  SELECT
    c.*,
    (c.price_iqd + c.shipping_cost + c.commission_addon + c.pdc + c.referral) AS preorder_final
  FROM calc c
),
tiered AS (
  SELECT
    p.*,
    -- Find matching tier from fee_tiers where preorder_final is in [min,max]
    (
      SELECT t
      FROM jsonb_array_elements(p.pp -> 'fee_tiers') AS t
      WHERE p.preorder_final >= COALESCE((t->>'min_amount')::numeric, 0)
        AND p.preorder_final <= COALESCE((t->>'max_amount')::numeric, 0)
      LIMIT 1
    ) AS tier
  FROM preorder p
),
resolved AS (
  SELECT
    t.*,
    COALESCE(
      (t.tier->>'cod_fee_type'),
      (t.pp->>'cod_default_fee_type'),
      'percentage'
    ) AS cod_type,
    COALESCE(
      (t.tier->>'cod_fee_value')::numeric,
      (t.pp->>'cod_default_fee_value')::numeric,
      0
    ) AS cod_value
  FROM tiered t
),
final AS (
  SELECT
    r.id,
    r.round_up_price,
    r.preorder_final,
    r.price_iqd,
    r.shipping_cost,
    r.commission_addon,
    r.pdc,
    r.referral,
    CASE
      WHEN r.cod_type = 'fixed' THEN CEIL(r.cod_value)
      ELSE CEIL((r.preorder_final * r.cod_value) / 100)
    END AS direct_portion
  FROM resolved r
  WHERE r.cod_value > 0
),
totals AS (
  SELECT
    f.id,
    f.direct_portion,
    (f.price_iqd + f.shipping_cost + f.commission_addon + f.direct_portion + f.pdc + f.referral) AS raw_total,
    f.round_up_price
  FROM final f
)
UPDATE products p
SET
  commission_direct_iqd = t.direct_portion,
  direct_sale_price = CASE
    WHEN t.round_up_price THEN CEIL(t.raw_total / 250.0) * 250
    ELSE t.raw_total
  END,
  updated_at = now()
FROM totals t
WHERE p.id = t.id;