CREATE OR REPLACE FUNCTION public.compute_product_live_direct_sale_price(p_product_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  p record;
  v_rate numeric;
  v_cod jsonb;
  v_cod_type text;
  v_cod_value numeric;
  v_tiers jsonb;
  v_tier jsonb;
  v_price_iqd numeric;
  v_pdc numeric;
  v_referral numeric;
  v_sea numeric;
  v_air numeric;
  v_land numeric;
  v_shipping numeric;
  v_pre_commission_addon numeric := 0;
  v_preorder_final numeric;
  v_direct_portion numeric;
  v_total numeric;
  v_tokens text[];
  v_has_sea boolean;
  v_has_air boolean;
  v_has_land boolean;
BEGIN
  SELECT id, link_direct_commission_to_cod, has_pre_order, shipping_type, price_usd,
         personal_delivery_cost, referral_earnings_iqd,
         commission_sea_iqd, commission_air_iqd, commission_land_iqd,
         sea_price, air_price,
         shipping_cost_iqd, round_up_price, direct_sale_price
    INTO p FROM public.products WHERE id = p_product_id;

  IF NOT FOUND OR NOT COALESCE(p.link_direct_commission_to_cod, false) THEN
    RETURN p.direct_sale_price;
  END IF;

  SELECT setting_value::numeric INTO v_rate FROM public.shipping_settings WHERE setting_key = 'usd_to_iqd_rate';
  IF v_rate IS NULL OR v_rate <= 0 OR p.price_usd IS NULL OR p.price_usd <= 0 THEN
    RETURN p.direct_sale_price;
  END IF;

  SELECT setting_value::jsonb INTO v_cod FROM public.default_settings WHERE setting_key = 'partial_payment_settings';
  IF v_cod IS NULL THEN RETURN p.direct_sale_price; END IF;

  v_cod_type  := COALESCE(v_cod->>'cod_default_fee_type', 'percentage');
  v_cod_value := COALESCE((v_cod->>'cod_default_fee_value')::numeric, 0);
  v_tiers     := v_cod->'fee_tiers';

  v_price_iqd := round(p.price_usd * v_rate);
  v_pdc       := COALESCE(p.personal_delivery_cost, 0);
  v_referral  := COALESCE(p.referral_earnings_iqd, 0);
  v_sea       := COALESCE(p.commission_sea_iqd, 0);
  v_air       := COALESCE(p.commission_air_iqd, 0);
  v_land      := COALESCE(p.commission_land_iqd, 0);
  v_shipping  := COALESCE(p.shipping_cost_iqd, 0);

  -- Handle comma-separated shipping_type (new format) AND legacy 'both'
  v_tokens   := string_to_array(COALESCE(p.shipping_type, ''), ',');
  v_has_sea  := ('sea'  = ANY(v_tokens)) OR (p.shipping_type = 'both');
  v_has_air  := ('air'  = ANY(v_tokens)) OR (p.shipping_type = 'both');
  v_has_land := ('land' = ANY(v_tokens));

  IF COALESCE(p.has_pre_order, false) THEN
    IF v_has_sea THEN
      v_pre_commission_addon := v_sea;
    ELSIF v_has_air THEN
      v_pre_commission_addon := v_air;
    ELSIF v_has_land THEN
      v_pre_commission_addon := v_land;
    END IF;
  END IF;

  v_preorder_final := v_price_iqd + v_shipping + v_pre_commission_addon + v_pdc + v_referral;

  IF jsonb_typeof(v_tiers) = 'array' THEN
    SELECT t INTO v_tier
      FROM jsonb_array_elements(v_tiers) t
     WHERE v_preorder_final >= COALESCE((t->>'min_amount')::numeric, 0)
       AND v_preorder_final <= COALESCE((t->>'max_amount')::numeric, 9.99e15)
     ORDER BY COALESCE((t->>'min_amount')::numeric, 0) DESC
     LIMIT 1;
    IF v_tier IS NOT NULL AND v_tier ? 'cod_fee_value' THEN
      v_cod_type  := COALESCE(v_tier->>'cod_fee_type','percentage');
      v_cod_value := COALESCE((v_tier->>'cod_fee_value')::numeric, 0);
    END IF;
  END IF;

  IF v_cod_value <= 0 THEN RETURN p.direct_sale_price; END IF;

  IF v_cod_type = 'fixed' THEN
    v_direct_portion := ceil(v_cod_value);
  ELSE
    v_direct_portion := ceil(v_preorder_final * v_cod_value / 100.0);
  END IF;

  v_total := v_price_iqd + v_shipping + v_pre_commission_addon + v_direct_portion + v_pdc + v_referral;
  IF COALESCE(p.round_up_price, false) THEN
    v_total := ceil(v_total / 250.0) * 250;
  END IF;
  RETURN v_total;
END;
$function$;