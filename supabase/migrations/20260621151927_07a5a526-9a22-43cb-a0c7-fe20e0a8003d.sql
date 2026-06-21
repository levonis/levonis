
INSERT INTO public.shipping_settings (setting_key, setting_value)
VALUES ('air_use_volumetric_weight', 1)
ON CONFLICT (setting_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.recompute_product_prices(p_product_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p RECORD;
  s RECORD;
  v_price_iqd numeric := 0;
  v_pdc numeric := 0;
  v_ref numeric := 0;
  v_other numeric := 0;
  v_csea numeric := 0;
  v_cair numeric := 0;
  v_cland numeric := 0;
  v_cdirect numeric := 0;
  v_round boolean := false;
  v_sea_pad numeric := 5;
  v_cbm numeric := 0;
  v_vol_weight numeric := 0;
  v_used_weight numeric := 0;
  v_safety numeric := 0;
  v_sea_ship numeric := 0;
  v_air_ship numeric := 0;
  v_land_ship numeric := 0;
  v_sea_price numeric;
  v_air_price numeric;
  v_land_price numeric;
  v_direct_price numeric;
  v_direct_ship numeric := 0;
  v_pre_commission_addon numeric := 0;
  v_shipping_cost numeric := 0;
  v_cod jsonb;
  v_cod_type text;
  v_cod_value numeric;
  v_preorder_base numeric;
  v_tier jsonb;
  v_tokens text[];
  v_has_sea  boolean;
  v_has_air  boolean;
  v_has_land boolean;
  v_use_volumetric boolean;
BEGIN
  SELECT * INTO p FROM public.products WHERE id = p_product_id;
  IF NOT FOUND THEN RETURN; END IF;
  IF p.price_usd IS NULL OR p.price_usd <= 0 THEN RETURN; END IF;

  SELECT
    COALESCE(MAX(CASE WHEN setting_key='usd_to_iqd_rate'                  THEN setting_value::numeric END), 1410)   AS usd_to_iqd_rate,
    COALESCE(MAX(CASE WHEN setting_key='sea_cbm_price'                    THEN setting_value::numeric END), 350000) AS sea_cbm_price,
    COALESCE(MAX(CASE WHEN setting_key='sea_padding_cm'                   THEN setting_value::numeric END), 5)      AS sea_padding_cm,
    COALESCE(MAX(CASE WHEN setting_key='air_china_volumetric_price'       THEN setting_value::numeric END), 15000)  AS air_price,
    COALESCE(MAX(CASE WHEN setting_key='air_china_volumetric_divider'     THEN setting_value::numeric END), 5000)   AS air_divider,
    COALESCE(MAX(CASE WHEN setting_key='air_china_weight_safety_margin'   THEN setting_value::numeric END), 20)     AS air_safety,
    COALESCE(MAX(CASE WHEN setting_key='land_price_per_kg_usd'            THEN setting_value::numeric END), 4)      AS land_per_kg_usd,
    COALESCE(MAX(CASE WHEN setting_key='air_use_volumetric_weight'        THEN setting_value::numeric END), 1)      AS air_use_volumetric
  INTO s FROM public.shipping_settings;

  v_price_iqd := round(p.price_usd * s.usd_to_iqd_rate);
  v_pdc       := COALESCE(p.personal_delivery_cost, 0);
  v_ref       := COALESCE(p.referral_earnings_iqd, 0);
  v_other     := COALESCE(p.other_costs_iqd, 0);
  v_csea      := COALESCE(p.commission_sea_iqd, 0);
  v_cair      := COALESCE(p.commission_air_iqd, 0);
  v_cland     := COALESCE(p.commission_land_iqd, 0);
  v_cdirect   := COALESCE(p.commission_direct_iqd, 0);
  v_round     := COALESCE(p.round_up_price, false);
  v_sea_pad   := s.sea_padding_cm;
  v_use_volumetric := COALESCE(s.air_use_volumetric, 1) >= 1;

  v_tokens := string_to_array(COALESCE(p.shipping_type, ''), ',');
  v_has_sea  := ('sea'  = ANY(v_tokens)) OR (p.shipping_type = 'both');
  v_has_air  := ('air'  = ANY(v_tokens)) OR (p.shipping_type = 'both');
  v_has_land := ('land' = ANY(v_tokens));

  IF p.length_cm IS NOT NULL AND p.width_cm IS NOT NULL AND p.height_cm IS NOT NULL
     AND (p.length_cm > 0 OR p.width_cm > 0 OR p.height_cm > 0) THEN
    v_cbm := ((COALESCE(p.length_cm,0) + v_sea_pad) / 100.0)
           * ((COALESCE(p.width_cm,0)  + v_sea_pad) / 100.0)
           * ((COALESCE(p.height_cm,0) + v_sea_pad) / 100.0);
    v_sea_ship := round(v_cbm * s.sea_cbm_price);
  END IF;

  IF (p.length_cm IS NOT NULL AND p.length_cm > 0)
     OR (p.weight_kg IS NOT NULL AND p.weight_kg > 0) THEN
    v_vol_weight := 0;
    IF v_use_volumetric AND p.length_cm IS NOT NULL AND p.length_cm > 0 THEN
      v_vol_weight := ((COALESCE(p.length_cm,0) + v_sea_pad)
                     * (COALESCE(p.width_cm,0)  + v_sea_pad)
                     * (COALESCE(p.height_cm,0) + v_sea_pad)) / s.air_divider;
    END IF;
    IF v_use_volumetric THEN
      v_used_weight := GREATEST(v_vol_weight, COALESCE(p.weight_kg, 0));
    ELSE
      v_used_weight := COALESCE(p.weight_kg, 0);
    END IF;
    IF v_used_weight > 0 THEN
      v_safety := s.air_safety / 100.0;
      v_air_ship := round(v_used_weight * (1 + v_safety) * s.air_price);
    END IF;
  END IF;

  IF p.weight_kg IS NOT NULL AND p.weight_kg > 0 THEN
    v_land_ship := round(p.weight_kg * s.land_per_kg_usd * s.usd_to_iqd_rate);
  END IF;

  IF COALESCE(p.has_pre_order, false) THEN
    IF v_has_sea THEN
      v_sea_price := v_price_iqd + v_sea_ship + v_csea + v_pdc + v_ref;
      v_shipping_cost := v_sea_ship;
    END IF;
    IF v_has_air THEN
      v_air_price := v_price_iqd + v_air_ship + v_cair + v_pdc + v_ref;
      IF v_shipping_cost = 0 THEN v_shipping_cost := v_air_ship; END IF;
    END IF;
    IF v_has_land THEN
      v_land_price := v_price_iqd + v_land_ship + v_cland + v_pdc + v_ref;
      IF v_shipping_cost = 0 THEN v_shipping_cost := v_land_ship; END IF;
    END IF;
  END IF;

  IF COALESCE(p.has_in_stock, false) THEN
    IF COALESCE(p.has_pre_order, false) THEN
      IF v_has_sea THEN
        v_direct_ship := v_sea_ship;
        v_pre_commission_addon := v_csea;
      ELSIF v_has_air THEN
        v_direct_ship := v_air_ship;
        v_pre_commission_addon := v_cair;
      ELSIF v_has_land THEN
        v_direct_ship := v_land_ship;
        v_pre_commission_addon := v_cland;
      END IF;
    END IF;

    IF COALESCE(p.link_direct_commission_to_cod, false) THEN
      SELECT setting_value::jsonb INTO v_cod FROM public.default_settings
       WHERE setting_key = 'partial_payment_settings';
      IF v_cod IS NOT NULL THEN
        v_cod_type  := COALESCE(v_cod->>'cod_default_fee_type', 'percentage');
        v_cod_value := COALESCE((v_cod->>'cod_default_fee_value')::numeric, 0);
        v_preorder_base := v_price_iqd + v_direct_ship + v_pre_commission_addon + v_pdc + v_ref;

        IF jsonb_typeof(v_cod->'fee_tiers') = 'array' THEN
          SELECT t INTO v_tier FROM jsonb_array_elements(v_cod->'fee_tiers') t
            WHERE (t->>'min_amount')::numeric <= v_preorder_base
              AND (COALESCE((t->>'max_amount')::numeric, 9.99e15)) >= v_preorder_base
            ORDER BY (t->>'min_amount')::numeric DESC
            LIMIT 1;
          IF v_tier IS NOT NULL THEN
            v_cod_type  := COALESCE(v_tier->>'fee_type', v_cod_type);
            v_cod_value := COALESCE((v_tier->>'fee_value')::numeric, v_cod_value);
          END IF;
        END IF;

        IF v_cod_type = 'percentage' THEN
          v_cdirect := round(v_preorder_base * v_cod_value / 100.0);
        ELSE
          v_cdirect := round(v_cod_value);
        END IF;
      END IF;
    END IF;

    v_direct_price := v_price_iqd + v_direct_ship + v_pre_commission_addon + v_other + v_cdirect + v_pdc + v_ref;
  END IF;

  IF v_round THEN
    IF v_sea_price    IS NOT NULL THEN v_sea_price    := ceil(v_sea_price    / 250.0) * 250; END IF;
    IF v_air_price    IS NOT NULL THEN v_air_price    := ceil(v_air_price    / 250.0) * 250; END IF;
    IF v_land_price   IS NOT NULL THEN v_land_price   := ceil(v_land_price   / 250.0) * 250; END IF;
    IF v_direct_price IS NOT NULL THEN v_direct_price := ceil(v_direct_price / 250.0) * 250; END IF;
  END IF;

  UPDATE public.products
     SET sea_price         = v_sea_price,
         air_price         = v_air_price,
         land_price        = v_land_price,
         direct_sale_price = v_direct_price,
         shipping_cost_iqd = NULLIF(v_shipping_cost, 0),
         commission_direct_iqd = CASE WHEN COALESCE(p.link_direct_commission_to_cod, false)
                                      THEN v_cdirect ELSE p.commission_direct_iqd END,
         updated_at        = now()
   WHERE id = p_product_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.recompute_product_prices(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.recompute_product_prices(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.recompute_on_shipping_settings_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  affects_air boolean;
  affects_sea boolean;
  affects_land boolean;
  affects_all boolean;
BEGIN
  affects_air  := NEW.setting_key IN ('air_china_volumetric_price','air_china_volumetric_divider','air_china_weight_safety_margin','air_use_volumetric_weight');
  affects_sea  := NEW.setting_key IN ('sea_cbm_price','sea_padding_cm');
  affects_land := NEW.setting_key IN ('land_price_per_kg_usd');
  affects_all  := NEW.setting_key IN ('usd_to_iqd_rate');

  FOR r IN
    SELECT id FROM public.products
     WHERE price_usd IS NOT NULL AND price_usd > 0
       AND (
         affects_all
         OR (affects_air  AND (shipping_type LIKE '%air%'  OR shipping_type = 'both'))
         OR (affects_sea  AND (shipping_type LIKE '%sea%'  OR shipping_type = 'both'))
         OR (affects_land AND shipping_type LIKE '%land%')
       )
  LOOP
    PERFORM public.recompute_product_prices(r.id);
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shipping_settings_recompute ON public.shipping_settings;
CREATE TRIGGER trg_shipping_settings_recompute
AFTER INSERT OR UPDATE ON public.shipping_settings
FOR EACH ROW EXECUTE FUNCTION public.recompute_on_shipping_settings_change();
