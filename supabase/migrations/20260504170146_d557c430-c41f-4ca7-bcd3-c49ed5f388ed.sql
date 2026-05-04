
-- 1) Revoke product internal cost columns from non-admin readers
REVOKE SELECT (cost_price, commission_iqd, commission_sea_iqd, commission_air_iqd, commission_direct_iqd, other_costs_iqd, shipping_cost_iqd) ON public.products FROM anon, authenticated;

-- 2) Admin-only view exposing all product columns
CREATE OR REPLACE VIEW public.products_admin AS
SELECT * FROM public.products WHERE public.has_role(auth.uid(), 'admin');
ALTER VIEW public.products_admin SET (security_invoker = true);
GRANT SELECT ON public.products_admin TO authenticated;

-- 3) Live direct-sale price RPCs
CREATE OR REPLACE FUNCTION public.compute_product_live_direct_sale_price(p_product_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
  v_shipping numeric;
  v_sea_addon numeric;
  v_air_addon numeric;
  v_preorder_final numeric;
  v_direct_portion numeric;
  v_total numeric;
BEGIN
  SELECT id, link_direct_commission_to_cod, has_pre_order, shipping_type, price_usd,
         personal_delivery_cost, referral_earnings_iqd,
         commission_sea_iqd, commission_air_iqd, sea_price, air_price,
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
  v_shipping  := COALESCE(p.shipping_cost_iqd, 0);
  v_sea_addon := CASE WHEN p.has_pre_order AND p.shipping_type IN ('sea','both') THEN v_sea ELSE 0 END;
  v_air_addon := CASE WHEN p.has_pre_order AND p.shipping_type = 'air' THEN v_air ELSE 0 END;
  v_preorder_final := v_price_iqd + v_shipping + v_sea_addon + v_air_addon + v_pdc + v_referral;

  IF jsonb_typeof(v_tiers) = 'array' THEN
    SELECT t INTO v_tier FROM jsonb_array_elements(v_tiers) t
     WHERE v_preorder_final >= COALESCE((t->>'min_amount')::numeric, 0)
       AND v_preorder_final <= COALESCE((t->>'max_amount')::numeric, 0)
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

  v_total := v_price_iqd + v_shipping + v_sea_addon + v_air_addon + v_direct_portion + v_pdc + v_referral;
  IF COALESCE(p.round_up_price, false) THEN
    v_total := ceil(v_total / 250.0) * 250;
  END IF;
  RETURN v_total;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.compute_product_live_direct_sale_price(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_product_live_direct_sale_price(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.compute_products_live_direct_sale_prices(p_ids uuid[])
RETURNS TABLE(product_id uuid, direct_sale_price numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, public.compute_product_live_direct_sale_price(id) FROM public.products WHERE id = ANY(p_ids);
$$;
REVOKE EXECUTE ON FUNCTION public.compute_products_live_direct_sale_prices(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_products_live_direct_sale_prices(uuid[]) TO anon, authenticated;

-- 4) community_complaints reported-user safe view
CREATE OR REPLACE VIEW public.community_complaints_reported_view AS
SELECT id, complainant_id, reported_user_id, complaint_type, description, status, created_at, updated_at
FROM public.community_complaints
WHERE auth.uid() = reported_user_id;
ALTER VIEW public.community_complaints_reported_view SET (security_invoker = true);
GRANT SELECT ON public.community_complaints_reported_view TO authenticated;

DROP POLICY IF EXISTS "Reported users can view their complaint (safe cols)" ON public.community_complaints;
DROP POLICY IF EXISTS "Reported users can view their complaint" ON public.community_complaints;

-- 5) merchant_applications owner-safe view (hides admin_notes)
CREATE OR REPLACE VIEW public.merchant_applications_owner_view AS
SELECT id, user_id, status, fee_status, created_at, updated_at,
       display_name, phone_number, city, bio, store_image_url, social_links,
       registration_fee, fee_transaction_id, is_verified, badge_tier,
       selected_frame_id, specialty, rejected_at,
       welcome_message, away_message, inquiry_template, is_away,
       store_layout, store_paused, store_pause_end_date, store_pause_message
FROM public.merchant_applications
WHERE auth.uid() = user_id;
ALTER VIEW public.merchant_applications_owner_view SET (security_invoker = true);
GRANT SELECT ON public.merchant_applications_owner_view TO authenticated;

-- 6) Realtime channel authorization
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authed users can subscribe to own-scoped channels" ON realtime.messages;
CREATE POLICY "Authed users can subscribe to own-scoped channels"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() LIKE '%' || auth.uid()::text || '%'
  OR public.has_role(auth.uid(), 'admin')
);

-- 7) Crossy road timing validation
CREATE OR REPLACE FUNCTION public.end_crossy_road(p_session_token text, p_score integer, p_steps integer DEFAULT 0, p_coins integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_session record;
  v_settings record;
  v_points integer;
  v_game_score integer;
  v_today_points integer;
  v_elapsed_seconds numeric;
  v_max_steps integer;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO v_session FROM crossy_road_sessions
  WHERE session_token = p_session_token AND user_id = v_user_id AND status = 'active'
  LIMIT 1;

  IF v_session IS NULL THEN
    SELECT * INTO v_session FROM crossy_road_sessions
    WHERE user_id = v_user_id AND status = 'active'
    ORDER BY started_at DESC LIMIT 1;
  END IF;

  IF v_session IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_session');
  END IF;

  SELECT * INTO v_settings FROM crossy_road_settings LIMIT 1;

  v_elapsed_seconds := EXTRACT(EPOCH FROM (now() - v_session.started_at));
  v_max_steps := GREATEST(FLOOR(v_elapsed_seconds * 3)::integer, 5);
  p_steps := LEAST(GREATEST(p_steps, 0), v_max_steps);
  p_coins := LEAST(GREATEST(p_coins, 0), GREATEST(p_steps / 2, 0));

  v_game_score := (p_steps * COALESCE(v_settings.score_per_step, 1))
                + (p_coins * COALESCE(v_settings.score_per_coin, 5));

  v_points := (p_steps * COALESCE(NULLIF(v_settings.points_per_step, 0), 1))
            + (p_coins * COALESCE(NULLIF(v_settings.bonus_coin_points, 0), 5));

  IF v_settings.max_daily_points IS NOT NULL THEN
    SELECT COALESCE(SUM(points_awarded), 0) INTO v_today_points
    FROM crossy_road_sessions
    WHERE user_id = v_user_id
      AND ended_at::date = CURRENT_DATE
      AND status = 'completed';

    IF v_today_points >= v_settings.max_daily_points THEN
      v_points := 0;
    ELSIF v_today_points + v_points > v_settings.max_daily_points THEN
      v_points := GREATEST(0, v_settings.max_daily_points - v_today_points);
    END IF;
  END IF;

  UPDATE crossy_road_sessions SET
    status = 'completed',
    score = v_game_score,
    steps_taken = p_steps,
    coins_collected = p_coins,
    points_awarded = v_points,
    ended_at = now()
  WHERE id = v_session.id;

  IF v_points > 0 THEN
    INSERT INTO user_points (user_id, total_points, available_points, total_earned)
    VALUES (v_user_id, v_points, v_points, v_points)
    ON CONFLICT (user_id) DO UPDATE
      SET total_points = user_points.total_points + v_points,
          available_points = user_points.available_points + v_points,
          total_earned = COALESCE(user_points.total_earned, 0) + v_points,
          updated_at = now();

    INSERT INTO points_transactions (user_id, points, type, source, description)
    VALUES (v_user_id, v_points, 'earned', 'crossy_road',
            'نقاط لعبة Crossy Road: ' || p_steps || ' خطوة + ' || p_coins || ' عملة');

    UPDATE crossy_road_settings
    SET total_points_distributed = COALESCE(total_points_distributed, 0) + v_points,
        updated_at = now();
  END IF;

  INSERT INTO crossy_road_high_scores (user_id, high_score, best_steps, all_time_high_score)
  VALUES (v_user_id, v_game_score, p_steps, v_game_score)
  ON CONFLICT (user_id) DO UPDATE
    SET high_score = GREATEST(crossy_road_high_scores.high_score, v_game_score),
        best_steps = GREATEST(crossy_road_high_scores.best_steps, p_steps),
        all_time_high_score = GREATEST(COALESCE(crossy_road_high_scores.all_time_high_score, 0), v_game_score),
        updated_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'points_awarded', v_points,
    'game_score', v_game_score,
    'coins', p_coins,
    'steps', p_steps,
    'session_id', v_session.id
  );
END;
$function$;
