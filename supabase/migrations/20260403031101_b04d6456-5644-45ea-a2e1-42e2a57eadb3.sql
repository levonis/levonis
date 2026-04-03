
-- =============================================
-- KNIFE RAIN GAME SYSTEM
-- =============================================

-- Settings table
CREATE TABLE public.knife_rain_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_enabled boolean NOT NULL DEFAULT true,
  entry_fee_tickets integer NOT NULL DEFAULT 2,
  points_per_knife integer NOT NULL DEFAULT 1,
  stage_clear_bonus integer NOT NULL DEFAULT 5,
  boss_bonus integer NOT NULL DEFAULT 15,
  game_points_per_knife integer NOT NULL DEFAULT 1,
  game_combo_multiplier numeric NOT NULL DEFAULT 1,
  max_daily_plays integer DEFAULT NULL,
  total_plays integer NOT NULL DEFAULT 0,
  total_points_distributed integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.knife_rain_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read knife_rain_settings" ON public.knife_rain_settings FOR SELECT USING (true);
CREATE POLICY "Admins can update knife_rain_settings" ON public.knife_rain_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Insert default settings
INSERT INTO public.knife_rain_settings (game_enabled, entry_fee_tickets, points_per_knife, stage_clear_bonus, boss_bonus, game_points_per_knife, game_combo_multiplier)
VALUES (true, 2, 1, 5, 15, 1, 1);

-- Sessions table
CREATE TABLE public.knife_rain_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_token text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  score integer DEFAULT 0,
  stage_reached integer DEFAULT 0,
  knives_thrown integer DEFAULT 0,
  points_awarded integer DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);

ALTER TABLE public.knife_rain_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own knife_rain_sessions" ON public.knife_rain_sessions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own knife_rain_sessions" ON public.knife_rain_sessions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own knife_rain_sessions" ON public.knife_rain_sessions FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- High scores
CREATE TABLE public.knife_rain_high_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  high_score integer NOT NULL DEFAULT 0,
  best_stage integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.knife_rain_high_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read knife_rain_high_scores" ON public.knife_rain_high_scores FOR SELECT USING (true);
CREATE POLICY "Users can upsert own knife_rain_high_scores" ON public.knife_rain_high_scores FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own knife_rain_high_scores" ON public.knife_rain_high_scores FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Milestones
CREATE TABLE public.knife_rain_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_score integer NOT NULL,
  prize_name_ar text NOT NULL DEFAULT '',
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  selected_color text,
  selected_option_id uuid REFERENCES public.product_options(id) ON DELETE SET NULL,
  stock integer NOT NULL DEFAULT 10,
  claimed_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.knife_rain_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read knife_rain_milestones" ON public.knife_rain_milestones FOR SELECT USING (true);
CREATE POLICY "Admins can manage knife_rain_milestones" ON public.knife_rain_milestones FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Milestone claims (prevent double)
CREATE TABLE public.knife_rain_milestone_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id uuid NOT NULL REFERENCES public.knife_rain_milestones(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  session_id uuid REFERENCES public.knife_rain_sessions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.knife_rain_milestone_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own knife_rain_milestone_claims" ON public.knife_rain_milestone_claims FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own knife_rain_milestone_claims" ON public.knife_rain_milestone_claims FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Leaderboard prizes
CREATE TABLE public.knife_rain_leaderboard_prizes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position integer NOT NULL UNIQUE,
  prize_name_ar text NOT NULL DEFAULT '',
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  selected_color text,
  selected_option_id uuid REFERENCES public.product_options(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.knife_rain_leaderboard_prizes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read knife_rain_leaderboard_prizes" ON public.knife_rain_leaderboard_prizes FOR SELECT USING (true);
CREATE POLICY "Admins can manage knife_rain_leaderboard_prizes" ON public.knife_rain_leaderboard_prizes FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Winners
CREATE TABLE public.knife_rain_winners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  prize_type text NOT NULL DEFAULT 'milestone',
  prize_name_ar text NOT NULL DEFAULT '',
  score integer,
  position integer,
  awarded_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.knife_rain_winners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read knife_rain_winners" ON public.knife_rain_winners FOR SELECT USING (true);
CREATE POLICY "Admins can manage knife_rain_winners" ON public.knife_rain_winners FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- RPC: start_knife_rain
-- =============================================
CREATE OR REPLACE FUNCTION public.start_knife_rain()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_settings knife_rain_settings%ROWTYPE;
  v_ticket_count integer;
  v_session_token text;
  v_session_id uuid;
  v_today_plays integer;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  UPDATE public.knife_rain_sessions
  SET status = 'expired', ended_at = now()
  WHERE user_id = v_user_id AND status = 'active'
    AND started_at < now() - interval '10 minutes';

  SELECT * INTO v_settings FROM knife_rain_settings LIMIT 1;

  IF v_settings IS NULL OR NOT v_settings.game_enabled THEN
    RETURN jsonb_build_object('success', false, 'error', 'game_disabled');
  END IF;

  IF v_settings.max_daily_plays IS NOT NULL THEN
    SELECT count(*) INTO v_today_plays
    FROM public.knife_rain_sessions
    WHERE user_id = v_user_id AND started_at::date = now()::date;
    IF v_today_plays >= v_settings.max_daily_plays THEN
      RETURN jsonb_build_object('success', false, 'error', 'daily_limit_reached');
    END IF;
  END IF;

  SELECT ticket_count INTO v_ticket_count
  FROM public.user_tickets
  WHERE user_id = v_user_id
  FOR UPDATE;

  IF v_ticket_count IS NULL OR v_ticket_count < v_settings.entry_fee_tickets THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_enough_tickets');
  END IF;

  UPDATE public.user_tickets
  SET ticket_count = ticket_count - v_settings.entry_fee_tickets, updated_at = now()
  WHERE user_id = v_user_id;

  v_session_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public.knife_rain_sessions (user_id, session_token, status)
  VALUES (v_user_id, v_session_token, 'active')
  RETURNING id INTO v_session_id;

  RETURN jsonb_build_object('success', true, 'session_id', v_session_id, 'session_token', v_session_token);
END;
$$;

-- =============================================
-- RPC: end_knife_rain
-- =============================================
CREATE OR REPLACE FUNCTION public.end_knife_rain(
  p_session_token text,
  p_score integer,
  p_stage integer DEFAULT 0,
  p_knives integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_session knife_rain_sessions%ROWTYPE;
  v_settings knife_rain_settings%ROWTYPE;
  v_game_score integer;
  v_website_points integer;
  v_elapsed_seconds numeric;
  v_max_reasonable_score integer;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO v_session
  FROM knife_rain_sessions
  WHERE session_token = p_session_token AND user_id = v_user_id AND status = 'active'
  FOR UPDATE;

  IF v_session.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_session');
  END IF;

  v_elapsed_seconds := EXTRACT(EPOCH FROM (now() - v_session.started_at));
  v_max_reasonable_score := GREATEST(FLOOR(v_elapsed_seconds * 2)::integer, 10);

  IF p_score > v_max_reasonable_score THEN
    p_score := v_max_reasonable_score;
  END IF;

  SELECT * INTO v_settings FROM knife_rain_settings LIMIT 1;

  v_game_score := p_score;

  v_website_points := FLOOR(
    p_knives * v_settings.points_per_knife
    + p_stage * v_settings.stage_clear_bonus
  )::integer;

  IF p_score > 0 AND v_website_points < 1 THEN
    v_website_points := 1;
  END IF;

  UPDATE knife_rain_sessions
  SET score = v_game_score,
      stage_reached = p_stage,
      knives_thrown = p_knives,
      points_awarded = v_website_points,
      status = 'completed',
      ended_at = now()
  WHERE id = v_session.id;

  IF v_website_points > 0 THEN
    INSERT INTO user_points (user_id, available_points, total_points)
    VALUES (v_user_id, v_website_points, v_website_points)
    ON CONFLICT (user_id) DO UPDATE
    SET available_points = user_points.available_points + v_website_points,
        total_points = user_points.total_points + v_website_points,
        updated_at = now();
  END IF;

  UPDATE knife_rain_settings
  SET total_plays = total_plays + 1,
      total_points_distributed = total_points_distributed + v_website_points,
      updated_at = now()
  WHERE id = v_settings.id;

  RETURN jsonb_build_object(
    'success', true,
    'game_score', v_game_score,
    'points_awarded', v_website_points,
    'session_id', v_session.id
  );
END;
$$;

-- =============================================
-- RPC: update_knife_rain_high_score
-- =============================================
CREATE OR REPLACE FUNCTION public.update_knife_rain_high_score(p_score integer, p_stage integer DEFAULT 0)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN RETURN; END IF;
  INSERT INTO knife_rain_high_scores (user_id, high_score, best_stage)
  VALUES (v_user_id, p_score, p_stage)
  ON CONFLICT (user_id) DO UPDATE
  SET high_score = GREATEST(knife_rain_high_scores.high_score, p_score),
      best_stage = GREATEST(knife_rain_high_scores.best_stage, p_stage),
      updated_at = now();
END;
$$;

-- =============================================
-- RPC: check_knife_rain_milestone
-- =============================================
CREATE OR REPLACE FUNCTION public.check_knife_rain_milestone(p_user_id uuid, p_score integer, p_session_id text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_milestone knife_rain_milestones%ROWTYPE;
  v_already_claimed boolean;
  v_product_name text;
  v_product_image text;
  v_option_name text;
  v_session_uuid uuid := NULL;
BEGIN
  IF p_session_id IS NOT NULL AND btrim(p_session_id) <> '' THEN
    BEGIN v_session_uuid := p_session_id::uuid;
    EXCEPTION WHEN others THEN v_session_uuid := NULL; END;
  END IF;

  FOR v_milestone IN
    SELECT * FROM public.knife_rain_milestones
    WHERE is_active = true AND p_score >= target_score AND claimed_count < stock
    ORDER BY target_score DESC
  LOOP
    IF v_session_uuid IS NOT NULL THEN
      SELECT EXISTS(
        SELECT 1 FROM public.knife_rain_milestone_claims
        WHERE milestone_id = v_milestone.id AND user_id = p_user_id AND session_id = v_session_uuid
      ) INTO v_already_claimed;
    ELSE
      SELECT EXISTS(
        SELECT 1 FROM public.knife_rain_milestone_claims
        WHERE milestone_id = v_milestone.id AND user_id = p_user_id AND session_id IS NULL
      ) INTO v_already_claimed;
    END IF;

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
    VALUES (v_milestone.id, p_user_id, v_session_uuid);

    INSERT INTO public.knife_rain_winners (user_id, prize_type, prize_name_ar, score)
    VALUES (p_user_id, 'milestone', COALESCE(v_product_name, v_milestone.prize_name_ar), p_score);

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

-- =============================================
-- RPC: claim_knife_rain_prize_to_cart
-- =============================================
CREATE OR REPLACE FUNCTION public.claim_knife_rain_prize_to_cart(p_milestone_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_milestone knife_rain_milestones%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO v_milestone FROM knife_rain_milestones WHERE id = p_milestone_id;
  IF v_milestone.id IS NULL OR v_milestone.product_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_milestone');
  END IF;

  INSERT INTO public.cart_items (user_id, product_id, product_option_id, selected_color, quantity, is_gift, is_locked)
  VALUES (v_user_id, v_milestone.product_id, v_milestone.selected_option_id, v_milestone.selected_color, 1, true, true);

  RETURN jsonb_build_object('success', true);
END;
$$;

-- =============================================
-- RPC: admin_award_knife_rain_winners
-- =============================================
CREATE OR REPLACE FUNCTION public.admin_award_knife_rain_winners()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_prize knife_rain_leaderboard_prizes%ROWTYPE;
  v_hs record;
  v_awarded integer := 0;
  v_product_name text;
  v_option_name text;
BEGIN
  IF NOT public.has_role(v_user_id, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_admin');
  END IF;

  FOR v_prize IN SELECT * FROM knife_rain_leaderboard_prizes WHERE is_active = true ORDER BY position ASC
  LOOP
    SELECT * INTO v_hs FROM knife_rain_high_scores ORDER BY high_score DESC LIMIT 1 OFFSET (v_prize.position - 1);
    IF v_hs IS NULL THEN CONTINUE; END IF;

    IF v_prize.product_id IS NOT NULL THEN
      v_option_name := NULL;
      IF v_prize.selected_option_id IS NOT NULL THEN
        SELECT name_ar INTO v_option_name FROM product_options WHERE id = v_prize.selected_option_id;
      END IF;
      PERFORM public.deduct_prize_stock(v_prize.product_id, v_prize.selected_color, v_option_name);
      SELECT name_ar INTO v_product_name FROM products WHERE id = v_prize.product_id;

      INSERT INTO cart_items (user_id, product_id, product_option_id, selected_color, quantity, is_gift, is_locked)
      VALUES (v_hs.user_id, v_prize.product_id, v_prize.selected_option_id, v_prize.selected_color, 1, true, true);
    END IF;

    INSERT INTO knife_rain_winners (user_id, prize_type, prize_name_ar, score, position)
    VALUES (v_hs.user_id, 'leaderboard', COALESCE(v_product_name, v_prize.prize_name_ar), v_hs.high_score, v_prize.position);

    v_awarded := v_awarded + 1;
  END LOOP;

  DELETE FROM knife_rain_high_scores;

  RETURN jsonb_build_object('success', true, 'winners_awarded', v_awarded);
END;
$$;
