
-- ============================================================
-- 1) Column-level REVOKE for sensitive cost/profit columns
-- ============================================================

-- orders: internal admin cost/profit columns
REVOKE SELECT (admin_product_cost, admin_shipping_cost, admin_other_costs, profit_amount, financial_notes, admin_paid_amount)
  ON public.orders FROM anon, authenticated, PUBLIC;

-- order_items: cost_price
REVOKE SELECT (cost_price) ON public.order_items FROM anon, authenticated, PUBLIC;

-- products: cost/commission/shipping columns
REVOKE SELECT (cost_price, commission_iqd, commission_sea_iqd, commission_air_iqd, commission_direct_iqd, other_costs_iqd, shipping_cost_iqd)
  ON public.products FROM anon, authenticated, PUBLIC;

-- product_offers: cost_price
REVOKE SELECT (cost_price) ON public.product_offers FROM anon, authenticated, PUBLIC;

-- product_options: cost_iqd, cost_usd
REVOKE SELECT (cost_iqd, cost_usd) ON public.product_options FROM anon, authenticated, PUBLIC;

-- Ensure admin views remain fully readable to service_role and admins
GRANT SELECT ON public.orders_admin TO authenticated, service_role;
GRANT SELECT ON public.order_items_admin TO authenticated, service_role;
GRANT SELECT ON public.products_admin TO authenticated, service_role;
GRANT SELECT ON public.product_offers_admin TO authenticated, service_role;

-- ============================================================
-- 2) Harden game high-score writes via SECURITY DEFINER RPCs
-- ============================================================

-- Drop client-writable UPDATE/INSERT policies on high score tables
DROP POLICY IF EXISTS "Users can update own high scores" ON public.stack_game_high_scores;
DROP POLICY IF EXISTS "Users can upsert own high scores" ON public.stack_game_high_scores;
DROP POLICY IF EXISTS "Users can update own knife_rain_high_scores" ON public.knife_rain_high_scores;
DROP POLICY IF EXISTS "Users can upsert own knife_rain_high_scores" ON public.knife_rain_high_scores;

-- Revoke direct write privileges; reads still allowed (public leaderboard)
REVOKE INSERT, UPDATE, DELETE ON public.stack_game_high_scores FROM anon, authenticated, PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON public.knife_rain_high_scores FROM anon, authenticated, PUBLIC;
GRANT ALL ON public.stack_game_high_scores TO service_role;
GRANT ALL ON public.knife_rain_high_scores TO service_role;

-- Submit Stack Game score: validates session belongs to caller and score matches
CREATE OR REPLACE FUNCTION public.submit_stack_game_score(_session_id uuid)
RETURNS public.stack_game_high_scores
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.stack_game_sessions;
  v_row public.stack_game_high_scores;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_session FROM public.stack_game_sessions WHERE id = _session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;
  IF v_session.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Session does not belong to caller';
  END IF;
  IF v_session.status NOT IN ('completed','ended','finished') THEN
    RAISE EXCEPTION 'Session is not completed';
  END IF;
  IF v_session.score IS NULL OR v_session.score < 0 THEN
    RAISE EXCEPTION 'Invalid session score';
  END IF;

  INSERT INTO public.stack_game_high_scores (user_id, high_score, achieved_at)
  VALUES (auth.uid(), v_session.score, now())
  ON CONFLICT (user_id) DO UPDATE
    SET high_score = GREATEST(public.stack_game_high_scores.high_score, EXCLUDED.high_score),
        achieved_at = CASE WHEN EXCLUDED.high_score > public.stack_game_high_scores.high_score
                           THEN now() ELSE public.stack_game_high_scores.achieved_at END
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_stack_game_score(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_stack_game_score(uuid) TO authenticated;

-- Submit Knife Rain score: same validation pattern
CREATE OR REPLACE FUNCTION public.submit_knife_rain_score(_session_id uuid)
RETURNS public.knife_rain_high_scores
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.knife_rain_sessions;
  v_row public.knife_rain_high_scores;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_session FROM public.knife_rain_sessions WHERE id = _session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;
  IF v_session.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Session does not belong to caller';
  END IF;
  IF v_session.status NOT IN ('completed','ended','finished') THEN
    RAISE EXCEPTION 'Session is not completed';
  END IF;
  IF v_session.score IS NULL OR v_session.score < 0 THEN
    RAISE EXCEPTION 'Invalid session score';
  END IF;

  INSERT INTO public.knife_rain_high_scores (user_id, high_score, best_stage, updated_at)
  VALUES (auth.uid(), v_session.score, COALESCE(v_session.stage_reached, 0), now())
  ON CONFLICT (user_id) DO UPDATE
    SET high_score = GREATEST(public.knife_rain_high_scores.high_score, EXCLUDED.high_score),
        best_stage = GREATEST(public.knife_rain_high_scores.best_stage, EXCLUDED.best_stage),
        updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_knife_rain_score(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_knife_rain_score(uuid) TO authenticated;
