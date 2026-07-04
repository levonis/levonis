
-- =====================================================================
-- 1. add_user_tickets: revoke execute from authenticated/anon
-- =====================================================================
REVOKE ALL ON FUNCTION public.add_user_tickets(uuid, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_user_tickets(uuid, integer, text) TO service_role;

-- Ensure inner body no longer trusts auth.uid() self-service either.
CREATE OR REPLACE FUNCTION public.add_user_tickets(p_user_id uuid, p_amount integer, p_source text DEFAULT 'system'::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only service_role callers (edge functions / cron / other SECURITY DEFINER fns chained from trusted RPCs) can credit tickets.
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: only service_role may credit tickets';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid amount: Must be positive';
  END IF;

  INSERT INTO user_tickets (user_id, ticket_count)
  VALUES (p_user_id, p_amount)
  ON CONFLICT (user_id)
  DO UPDATE SET 
    ticket_count = user_tickets.ticket_count + p_amount,
    updated_at = NOW();
  
  RETURN TRUE;
END;
$function$;

REVOKE ALL ON FUNCTION public.add_user_tickets(uuid, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_user_tickets(uuid, integer, text) TO service_role;

-- =====================================================================
-- 2. Atomic RPC for the game store to spend points + grant tickets
-- =====================================================================
CREATE OR REPLACE FUNCTION public.purchase_game_store_reward(p_reward_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_reward game_store_rewards%ROWTYPE;
  v_count integer;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO v_reward FROM public.game_store_rewards WHERE id = p_reward_id AND is_active = true;
  IF v_reward.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_reward');
  END IF;

  IF v_reward.max_purchases IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count FROM public.game_store_purchases
      WHERE user_id = v_user AND reward_id = p_reward_id;
    IF v_count >= v_reward.max_purchases THEN
      RETURN jsonb_build_object('success', false, 'error', 'max_reached');
    END IF;
  END IF;

  -- Deduct points atomically
  PERFORM public.deduct_user_points(v_user, v_reward.points_cost, 'game_store', 'متجر الألعاب: ' || v_reward.title_ar);

  -- Grant tickets if this reward type is tickets (call underlying inner logic directly since we are service definer)
  IF v_reward.reward_type = 'tickets' AND v_reward.reward_value > 0 THEN
    INSERT INTO public.user_tickets (user_id, ticket_count)
    VALUES (v_user, v_reward.reward_value)
    ON CONFLICT (user_id) DO UPDATE
      SET ticket_count = user_tickets.ticket_count + v_reward.reward_value,
          updated_at = NOW();
  END IF;

  INSERT INTO public.game_store_purchases (user_id, reward_id, points_spent)
  VALUES (v_user, p_reward_id, v_reward.points_cost);

  RETURN jsonb_build_object('success', true, 'reward_type', v_reward.reward_type, 'reward_value', v_reward.reward_value);
END;
$$;

REVOKE ALL ON FUNCTION public.purchase_game_store_reward(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purchase_game_store_reward(uuid) TO authenticated;

-- =====================================================================
-- 3. claim_crossy_road_prize_to_cart: require an actual claim record
-- =====================================================================
CREATE OR REPLACE FUNCTION public.claim_crossy_road_prize_to_cart(p_milestone_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_milestone record;
  v_claim record;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Require an unredeemed claim owned by the caller
  SELECT * INTO v_claim FROM public.crossy_road_milestone_claims
    WHERE milestone_id = p_milestone_id
      AND user_id = v_user_id
      AND COALESCE(redeemed, false) = false
    LIMIT 1
    FOR UPDATE;

  IF v_claim.id IS NULL THEN
    RAISE EXCEPTION 'no_valid_claim';
  END IF;

  SELECT * INTO v_milestone FROM public.crossy_road_milestones WHERE id = p_milestone_id;
  IF v_milestone IS NULL OR v_milestone.product_id IS NULL THEN
    RAISE EXCEPTION 'invalid_milestone';
  END IF;

  INSERT INTO public.cart_items (user_id, product_id, quantity, is_gift, is_locked, selected_color, product_option_id)
  VALUES (v_user_id, v_milestone.product_id, 1, true, true, v_milestone.selected_color, v_milestone.selected_option_id)
  ON CONFLICT DO NOTHING;

  UPDATE public.crossy_road_milestone_claims SET redeemed = true, redeemed_at = now() WHERE id = v_claim.id;
END;
$$;

-- Add redeemed columns if missing (idempotent)
ALTER TABLE public.crossy_road_milestone_claims
  ADD COLUMN IF NOT EXISTS redeemed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS redeemed_at timestamptz;

ALTER TABLE public.knife_rain_milestone_claims
  ADD COLUMN IF NOT EXISTS redeemed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS redeemed_at timestamptz;

-- =====================================================================
-- 4. claim_knife_rain_prize_to_cart: require an actual claim record
-- =====================================================================
CREATE OR REPLACE FUNCTION public.claim_knife_rain_prize_to_cart(p_milestone_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_milestone knife_rain_milestones%ROWTYPE;
  v_claim record;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO v_claim FROM public.knife_rain_milestone_claims
    WHERE milestone_id = p_milestone_id
      AND user_id = v_user_id
      AND COALESCE(redeemed, false) = false
    LIMIT 1
    FOR UPDATE;

  IF v_claim.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_valid_claim');
  END IF;

  SELECT * INTO v_milestone FROM knife_rain_milestones WHERE id = p_milestone_id;
  IF v_milestone.id IS NULL OR v_milestone.product_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_milestone');
  END IF;

  INSERT INTO public.cart_items (user_id, product_id, product_option_id, selected_color, quantity, is_gift, is_locked)
  VALUES (v_user_id, v_milestone.product_id, v_milestone.selected_option_id, v_milestone.selected_color, 1, true, true);

  UPDATE public.knife_rain_milestone_claims SET redeemed = true, redeemed_at = now() WHERE id = v_claim.id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- =====================================================================
-- 5. check_crossy_road_milestone: derive user from auth.uid(), verify score from session
-- =====================================================================
CREATE OR REPLACE FUNCTION public.check_crossy_road_milestone(p_user_id uuid, p_score integer, p_session_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_actual_score integer := 0;
  v_milestone record;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('won', false, 'error', 'not_authenticated');
  END IF;

  -- Ignore client-supplied user; always use auth.uid().
  IF p_session_id IS NOT NULL THEN
    SELECT COALESCE(score, 0) INTO v_actual_score
    FROM public.crossy_road_sessions
    WHERE id = p_session_id AND user_id = v_user;
  END IF;

  IF v_actual_score = 0 THEN
    RETURN jsonb_build_object('won', false);
  END IF;

  SELECT * INTO v_milestone FROM public.crossy_road_milestones
    WHERE is_active AND target_score <= v_actual_score AND claimed_count < stock
      AND id NOT IN (SELECT milestone_id FROM public.crossy_road_milestone_claims WHERE user_id = v_user)
    ORDER BY target_score DESC LIMIT 1;

  IF v_milestone IS NULL THEN
    RETURN jsonb_build_object('won', false);
  END IF;

  INSERT INTO public.crossy_road_milestone_claims (user_id, milestone_id, session_id)
  VALUES (v_user, v_milestone.id, p_session_id);
  UPDATE public.crossy_road_milestones SET claimed_count = claimed_count + 1 WHERE id = v_milestone.id;

  IF v_milestone.product_id IS NOT NULL THEN
    BEGIN PERFORM public.deduct_prize_stock(v_milestone.product_id, v_milestone.selected_color, v_milestone.selected_option_id); EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;

  RETURN jsonb_build_object('won', true, 'milestone_id', v_milestone.id, 'prize_name', v_milestone.prize_name_ar);
END;
$$;

-- =====================================================================
-- 6. check_knife_rain_milestone: derive user from auth.uid(), verify score from session
-- =====================================================================
CREATE OR REPLACE FUNCTION public.check_knife_rain_milestone(p_user_id uuid, p_score integer, p_session_id text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_session_uuid uuid := NULL;
  v_actual_score integer := 0;
  v_milestone knife_rain_milestones%ROWTYPE;
  v_already_claimed boolean;
  v_product_name text; v_product_image text; v_option_name text;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('won', false, 'error', 'not_authenticated');
  END IF;

  IF p_session_id IS NOT NULL AND btrim(p_session_id) <> '' THEN
    BEGIN v_session_uuid := p_session_id::uuid;
    EXCEPTION WHEN others THEN v_session_uuid := NULL; END;
  END IF;

  IF v_session_uuid IS NOT NULL THEN
    SELECT COALESCE(score, 0) INTO v_actual_score
    FROM public.knife_rain_sessions
    WHERE id = v_session_uuid AND user_id = v_user;
  END IF;

  IF v_actual_score = 0 THEN
    RETURN jsonb_build_object('won', false);
  END IF;

  FOR v_milestone IN
    SELECT * FROM public.knife_rain_milestones
    WHERE is_active = true AND v_actual_score >= target_score AND claimed_count < stock
    ORDER BY target_score DESC
  LOOP
    SELECT EXISTS(
      SELECT 1 FROM public.knife_rain_milestone_claims
      WHERE milestone_id = v_milestone.id AND user_id = v_user
    ) INTO v_already_claimed;

    IF v_already_claimed THEN CONTINUE; END IF;

    v_product_name := NULL; v_product_image := NULL; v_option_name := NULL;

    IF v_milestone.product_id IS NOT NULL THEN
      IF v_milestone.selected_option_id IS NOT NULL THEN
        SELECT name_ar INTO v_option_name FROM public.product_options WHERE id = v_milestone.selected_option_id;
      END IF;
      IF NOT public.deduct_prize_stock(v_milestone.product_id, v_milestone.selected_color, v_option_name) THEN
        CONTINUE;
      END IF;
      SELECT name_ar, image_url INTO v_product_name, v_product_image FROM public.products WHERE id = v_milestone.product_id;
    END IF;

    UPDATE public.knife_rain_milestones SET claimed_count = claimed_count + 1 WHERE id = v_milestone.id;

    INSERT INTO public.knife_rain_milestone_claims (milestone_id, user_id, session_id)
    VALUES (v_milestone.id, v_user, v_session_uuid);

    INSERT INTO public.knife_rain_winners (user_id, prize_type, prize_name_ar, score)
    VALUES (v_user, 'milestone', COALESCE(v_product_name, v_milestone.prize_name_ar), v_actual_score);

    RETURN jsonb_build_object(
      'won', true,
      'milestone_id', v_milestone.id,
      'prize_name', COALESCE(v_product_name, v_milestone.prize_name_ar),
      'prize_image', v_product_image,
      'stock_remaining', v_milestone.stock - v_milestone.claimed_count - 1
    );
  END LOOP;

  RETURN jsonb_build_object('won', false);
END;
$$;

-- =====================================================================
-- 7. listing_transactions: add admin-only DELETE policy
-- =====================================================================
DROP POLICY IF EXISTS "Admins can delete transactions" ON public.listing_transactions;
CREATE POLICY "Admins can delete transactions"
ON public.listing_transactions
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- =====================================================================
-- 8. merchant_ad_bookings.merchant_id: strongly type as uuid + FK
-- =====================================================================
DROP POLICY IF EXISTS "Merchant can read their ad bookings" ON public.merchant_ad_bookings;

ALTER TABLE public.merchant_ad_bookings
  ALTER COLUMN merchant_id TYPE uuid USING NULLIF(merchant_id, '')::uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'merchant_ad_bookings_merchant_id_fkey'
  ) THEN
    ALTER TABLE public.merchant_ad_bookings
      ADD CONSTRAINT merchant_ad_bookings_merchant_id_fkey
      FOREIGN KEY (merchant_id) REFERENCES public.merchant_applications(id) ON DELETE CASCADE;
  END IF;
END$$;

CREATE POLICY "Merchant can read their ad bookings"
ON public.merchant_ad_bookings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.merchant_applications ma
    WHERE ma.user_id = auth.uid()
      AND ma.id = merchant_ad_bookings.merchant_id
  )
);

-- =====================================================================
-- 9. print_quote_cache: restrict SELECT to service_role only (edge functions)
-- =====================================================================
DROP POLICY IF EXISTS "Authenticated can read quote cache" ON public.print_quote_cache;
-- No new policy -> only service_role (bypasses RLS) can read.

-- =====================================================================
-- 10. print_url_analytics: enforce user_id = auth.uid() OR null on insert
-- =====================================================================
DROP POLICY IF EXISTS "Authenticated insert url analytics" ON public.print_url_analytics;
CREATE POLICY "Authenticated insert url analytics"
ON public.print_url_analytics
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND (user_id IS NULL OR user_id = auth.uid()));
