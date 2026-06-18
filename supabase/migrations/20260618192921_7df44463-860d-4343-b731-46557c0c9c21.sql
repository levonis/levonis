
-- =========================================================
-- Live recomputation of product prices when admin changes
-- shipping settings (USD rate, CBM/kg prices) or COD defaults.
-- Mirrors the formula used in src/pages/Admin.tsx save handler.
-- =========================================================

CREATE OR REPLACE FUNCTION public.recompute_product_prices(p_product_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p record;
  s record;
  v_cod jsonb;
  v_cod_type text;
  v_cod_value numeric;
  v_tier jsonb;

  v_price_iqd numeric;
  v_pdc numeric;
  v_ref numeric;
  v_other numeric;
  v_csea numeric;
  v_cair numeric;
  v_cdirect numeric;

  -- Shipping intermediates
  v_sea_pad numeric;
  v_cbm numeric;
  v_sea_ship numeric := 0;
  v_air_ship numeric := 0;
  v_vol_weight numeric;
  v_used_weight numeric;
  v_safety numeric;

  v_sea_price numeric;
  v_air_price numeric;
  v_direct_price numeric;
  v_direct_ship numeric := 0;
  v_pre_commission_addon numeric := 0;
  v_preorder_base numeric;

  v_prices numeric[] := ARRAY[]::numeric[];
  v_main_price numeric;
  v_shipping_cost numeric := 0;

  v_round boolean;
BEGIN
  SELECT * INTO p FROM public.products WHERE id = p_product_id;
  IF NOT FOUND THEN RETURN; END IF;
  IF p.price_usd IS NULL OR p.price_usd <= 0 THEN RETURN; END IF;

  -- Load shipping settings into a record with defaults
  SELECT
    COALESCE(MAX(CASE WHEN setting_key='usd_to_iqd_rate'              THEN setting_value::numeric END), 1410)   AS usd_to_iqd_rate,
    COALESCE(MAX(CASE WHEN setting_key='sea_cbm_price'                THEN setting_value::numeric END), 350000) AS sea_cbm_price,
    COALESCE(MAX(CASE WHEN setting_key='sea_padding_cm'               THEN setting_value::numeric END), 5)      AS sea_padding_cm,
    COALESCE(MAX(CASE WHEN setting_key='air_china_volumetric_price'   THEN setting_value::numeric END), 15000)  AS air_price,
    COALESCE(MAX(CASE WHEN setting_key='air_china_volumetric_divider' THEN setting_value::numeric END), 5000)   AS air_divider,
    COALESCE(MAX(CASE WHEN setting_key='air_china_weight_safety_margin' THEN setting_value::numeric END), 20)    AS air_safety
  INTO s FROM public.shipping_settings;

  v_price_iqd := round(p.price_usd * s.usd_to_iqd_rate);
  v_pdc       := COALESCE(p.personal_delivery_cost, 0);
  v_ref       := COALESCE(p.referral_earnings_iqd, 0);
  v_other     := COALESCE(p.other_costs_iqd, 0);
  v_csea      := COALESCE(p.commission_sea_iqd, 0);
  v_cair      := COALESCE(p.commission_air_iqd, 0);
  v_cdirect   := COALESCE(p.commission_direct_iqd, 0);
  v_round     := COALESCE(p.round_up_price, false);
  v_sea_pad   := s.sea_padding_cm;

  -- Sea shipping (China only, CBM-based)
  IF p.length_cm IS NOT NULL AND p.width_cm IS NOT NULL AND p.height_cm IS NOT NULL
     AND (p.length_cm > 0 OR p.width_cm > 0 OR p.height_cm > 0) THEN
    v_cbm := ((COALESCE(p.length_cm,0) + v_sea_pad) / 100.0)
           * ((COALESCE(p.width_cm,0)  + v_sea_pad) / 100.0)
           * ((COALESCE(p.height_cm,0) + v_sea_pad) / 100.0);
    v_sea_ship := round(v_cbm * s.sea_cbm_price);
  END IF;

  -- Air shipping (China only, max(volumetric, actual) + safety margin)
  IF (p.length_cm IS NOT NULL AND p.length_cm > 0)
     OR (p.weight_kg IS NOT NULL AND p.weight_kg > 0) THEN
    v_vol_weight := 0;
    IF p.length_cm IS NOT NULL AND p.length_cm > 0 THEN
      v_vol_weight := ((COALESCE(p.length_cm,0) + v_sea_pad)
                     * (COALESCE(p.width_cm,0)  + v_sea_pad)
                     * (COALESCE(p.height_cm,0) + v_sea_pad)) / s.air_divider;
    END IF;
    v_used_weight := GREATEST(v_vol_weight, COALESCE(p.weight_kg, 0));
    IF v_used_weight > 0 THEN
      v_safety := s.air_safety / 100.0;
      v_air_ship := round(v_used_weight * (1 + v_safety) * s.air_price);
    END IF;
  END IF;

  -- Pre-order branch
  IF COALESCE(p.has_pre_order, false) THEN
    IF p.shipping_type IN ('sea','both') THEN
      v_sea_price := v_price_iqd + v_sea_ship + v_csea + v_pdc + v_ref;
      v_shipping_cost := v_sea_ship;
    END IF;
    IF p.shipping_type IN ('air','both') THEN
      v_air_price := v_price_iqd + v_air_ship + v_cair + v_pdc + v_ref;
      IF v_shipping_cost = 0 THEN v_shipping_cost := v_air_ship; END IF;
    END IF;
  END IF;

  -- Direct sale branch — mirrors Admin.tsx logic
  IF COALESCE(p.has_in_stock, false) THEN
    IF COALESCE(p.has_pre_order, false) THEN
      IF p.shipping_type IN ('sea','both') THEN
        v_direct_ship := v_sea_ship;
        v_pre_commission_addon := v_csea;
      ELSIF p.shipping_type = 'air' THEN
        v_direct_ship := v_air_ship;
        v_pre_commission_addon := v_cair;
      END IF;
    END IF;

    -- If linked to global COD %, derive commission_direct live
    IF COALESCE(p.link_direct_commission_to_cod, false) THEN
      SELECT setting_value::jsonb INTO v_cod FROM public.default_settings
       WHERE setting_key = 'partial_payment_settings';
      IF v_cod IS NOT NULL THEN
        v_cod_type  := COALESCE(v_cod->>'cod_default_fee_type', 'percentage');
        v_cod_value := COALESCE((v_cod->>'cod_default_fee_value')::numeric, 0);
        v_preorder_base := v_price_iqd + v_direct_ship + v_pre_commission_addon + v_pdc + v_ref;

        IF jsonb_typeof(v_cod->'fee_tiers') = 'array' THEN
          SELECT t INTO v_tier FROM jsonb_array_elements(v_cod->'fee_tiers') t
            WHERE v_preorder_base >= COALESCE((t->>'min_amount')::numeric, 0)
              AND v_preorder_base <= COALESCE((t->>'max_amount')::numeric, 0)
            LIMIT 1;
          IF v_tier IS NOT NULL AND v_tier ? 'cod_fee_value' THEN
            v_cod_type  := COALESCE(v_tier->>'cod_fee_type','percentage');
            v_cod_value := COALESCE((v_tier->>'cod_fee_value')::numeric, 0);
          END IF;
        END IF;

        IF v_cod_value > 0 THEN
          IF v_cod_type = 'fixed' THEN
            v_cdirect := ceil(v_cod_value);
          ELSE
            v_cdirect := ceil(v_preorder_base * v_cod_value / 100.0);
          END IF;
        END IF;
      END IF;
    END IF;

    v_direct_price := v_price_iqd + v_other + v_direct_ship + v_pre_commission_addon + v_cdirect + v_pdc + v_ref;
  END IF;

  -- Round up to 250 if enabled
  IF v_round THEN
    IF v_sea_price    IS NOT NULL THEN v_sea_price    := ceil(v_sea_price    / 250.0) * 250; END IF;
    IF v_air_price    IS NOT NULL THEN v_air_price    := ceil(v_air_price    / 250.0) * 250; END IF;
    IF v_direct_price IS NOT NULL THEN v_direct_price := ceil(v_direct_price / 250.0) * 250; END IF;
  END IF;

  -- Build candidate list for main price
  IF v_sea_price    IS NOT NULL THEN v_prices := array_append(v_prices, v_sea_price);    END IF;
  IF v_air_price    IS NOT NULL THEN v_prices := array_append(v_prices, v_air_price);    END IF;
  IF v_direct_price IS NOT NULL THEN v_prices := array_append(v_prices, v_direct_price); END IF;

  IF array_length(v_prices, 1) IS NOT NULL THEN
    SELECT min(x) INTO v_main_price FROM unnest(v_prices) x;
  ELSE
    v_main_price := v_price_iqd;
  END IF;

  UPDATE public.products SET
    sea_price            = v_sea_price,
    air_price            = v_air_price,
    direct_sale_price    = v_direct_price,
    price                = v_main_price,
    shipping_cost_iqd    = v_shipping_cost,
    commission_direct_iqd = CASE WHEN COALESCE(link_direct_commission_to_cod,false) THEN v_cdirect ELSE commission_direct_iqd END,
    updated_at           = now()
  WHERE id = p_product_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.recompute_product_prices(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.recompute_product_prices(uuid) TO authenticated, service_role;

-- Bulk recompute (admin/trigger use)
CREATE OR REPLACE FUNCTION public.recompute_all_product_prices()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  r record;
BEGIN
  FOR r IN SELECT id FROM public.products WHERE price_usd IS NOT NULL AND price_usd > 0 LOOP
    PERFORM public.recompute_product_prices(r.id);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.recompute_all_product_prices() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.recompute_all_product_prices() TO authenticated, service_role;

-- Trigger: when admin updates shipping_settings, refresh all products
CREATE OR REPLACE FUNCTION public.trg_recompute_on_shipping_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND NEW.setting_value IS DISTINCT FROM OLD.setting_value)
     OR TG_OP = 'INSERT' THEN
    PERFORM public.recompute_all_product_prices();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shipping_settings_recompute_products ON public.shipping_settings;
CREATE TRIGGER shipping_settings_recompute_products
AFTER INSERT OR UPDATE ON public.shipping_settings
FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_on_shipping_settings();

-- Trigger: when COD default settings change, refresh products linked to COD
CREATE OR REPLACE FUNCTION public.trg_recompute_on_default_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r record;
BEGIN
  IF NEW.setting_key = 'partial_payment_settings'
     AND (TG_OP = 'INSERT' OR NEW.setting_value IS DISTINCT FROM OLD.setting_value) THEN
    FOR r IN SELECT id FROM public.products
              WHERE price_usd IS NOT NULL AND price_usd > 0
                AND COALESCE(link_direct_commission_to_cod, false) = true LOOP
      PERFORM public.recompute_product_prices(r.id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS default_settings_recompute_products ON public.default_settings;
CREATE TRIGGER default_settings_recompute_products
AFTER INSERT OR UPDATE ON public.default_settings
FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_on_default_settings();

-- Run once now to refresh all existing products with the current settings.
SELECT public.recompute_all_product_prices();
