
-- ============================================================
-- CROSSY ROAD GAME – Tables, RLS, RPCs  (mirrors knife_rain)
-- ============================================================

-- 1. SETTINGS
CREATE TABLE public.crossy_road_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_enabled boolean NOT NULL DEFAULT true,
  entry_fee_tickets integer NOT NULL DEFAULT 2,
  points_per_step integer NOT NULL DEFAULT 1,
  bonus_coin_points integer NOT NULL DEFAULT 5,
  max_daily_plays integer DEFAULT NULL,
  total_plays bigint NOT NULL DEFAULT 0,
  total_points_distributed bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crossy_road_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read crossy_road_settings" ON public.crossy_road_settings FOR SELECT USING (true);

-- seed one row
INSERT INTO public.crossy_road_settings (game_enabled, entry_fee_tickets, points_per_step, bonus_coin_points)
VALUES (true, 2, 1, 5);

-- 2. SESSIONS
CREATE TABLE public.crossy_road_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_token text NOT NULL DEFAULT encode(gen_random_bytes(16),'hex'),
  status text NOT NULL DEFAULT 'active',
  score integer NOT NULL DEFAULT 0,
  steps_taken integer NOT NULL DEFAULT 0,
  coins_collected integer NOT NULL DEFAULT 0,
  points_awarded integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);
ALTER TABLE public.crossy_road_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own crossy sessions" ON public.crossy_road_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 3. HIGH SCORES
CREATE TABLE public.crossy_road_high_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  high_score integer NOT NULL DEFAULT 0,
  best_steps integer NOT NULL DEFAULT 0,
  season integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crossy_road_high_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read crossy high scores" ON public.crossy_road_high_scores FOR SELECT USING (true);

-- 4. MILESTONES
CREATE TABLE public.crossy_road_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_score integer NOT NULL,
  prize_name_ar text NOT NULL DEFAULT '',
  product_id uuid REFERENCES public.products(id),
  selected_color text,
  selected_option_id uuid REFERENCES public.product_options(id),
  stock integer NOT NULL DEFAULT 10,
  claimed_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crossy_road_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read crossy milestones" ON public.crossy_road_milestones FOR SELECT USING (true);

-- 5. MILESTONE CLAIMS
CREATE TABLE public.crossy_road_milestone_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  milestone_id uuid NOT NULL REFERENCES public.crossy_road_milestones(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.crossy_road_sessions(id),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, milestone_id)
);
ALTER TABLE public.crossy_road_milestone_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own crossy milestone claims" ON public.crossy_road_milestone_claims FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 6. LEADERBOARD PRIZES
CREATE TABLE public.crossy_road_leaderboard_prizes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position integer NOT NULL,
  prize_name_ar text NOT NULL DEFAULT '',
  product_id uuid REFERENCES public.products(id),
  selected_color text,
  selected_option_id uuid REFERENCES public.product_options(id),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crossy_road_leaderboard_prizes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read crossy lb prizes" ON public.crossy_road_leaderboard_prizes FOR SELECT USING (true);

-- 7. WINNERS
CREATE TABLE public.crossy_road_winners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  prize_type text NOT NULL DEFAULT 'leaderboard',
  prize_name_ar text NOT NULL DEFAULT '',
  position integer,
  score integer,
  season integer,
  product_id uuid REFERENCES public.products(id),
  selected_color text,
  selected_option_id uuid REFERENCES public.product_options(id),
  awarded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crossy_road_winners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read crossy winners" ON public.crossy_road_winners FOR SELECT USING (true);

-- ============================================================
-- RPC 1: start_crossy_road
-- ============================================================
CREATE OR REPLACE FUNCTION public.start_crossy_road()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_settings record;
  v_ticket_count integer;
  v_today_plays integer;
  v_session_token text;
  v_session_id uuid;
  v_has_free boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO v_settings FROM crossy_road_settings LIMIT 1;
  IF NOT v_settings.game_enabled THEN
    RETURN jsonb_build_object('success', false, 'error', 'game_disabled');
  END IF;

  -- check VIP free play
  BEGIN
    SELECT (check_vip_free_play(v_user_id, 'crossy_road')).has_free_play INTO v_has_free;
  EXCEPTION WHEN OTHERS THEN v_has_free := false;
  END;

  -- daily limit
  IF v_settings.max_daily_plays IS NOT NULL THEN
    SELECT count(*) INTO v_today_plays FROM crossy_road_sessions
    WHERE user_id = v_user_id AND started_at >= date_trunc('day', now());
    IF v_today_plays >= v_settings.max_daily_plays THEN
      RETURN jsonb_build_object('success', false, 'error', 'daily_limit_reached');
    END IF;
  END IF;

  -- deduct tickets if not VIP free
  IF NOT v_has_free THEN
    SELECT ticket_count INTO v_ticket_count FROM user_tickets WHERE user_id = v_user_id;
    IF v_ticket_count IS NULL OR v_ticket_count < v_settings.entry_fee_tickets THEN
      RETURN jsonb_build_object('success', false, 'error', 'not_enough_tickets');
    END IF;
    PERFORM set_config('app.bypass_ticket_fraud_check', 'true', true);
    UPDATE user_tickets SET ticket_count = ticket_count - v_settings.entry_fee_tickets, updated_at = now() WHERE user_id = v_user_id;
  END IF;

  -- create session
  INSERT INTO crossy_road_sessions (user_id) VALUES (v_user_id)
  RETURNING id, session_token INTO v_session_id, v_session_token;

  UPDATE crossy_road_settings SET total_plays = total_plays + 1 WHERE id = v_settings.id;

  RETURN jsonb_build_object('success', true, 'session_token', v_session_token, 'session_id', v_session_id);
END;
$$;

-- ============================================================
-- RPC 2: end_crossy_road
-- ============================================================
CREATE OR REPLACE FUNCTION public.end_crossy_road(
  p_session_token text,
  p_score integer,
  p_steps integer DEFAULT 0,
  p_coins integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_session record;
  v_settings record;
  v_points integer;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false);
  END IF;

  SELECT * INTO v_session FROM crossy_road_sessions
  WHERE session_token = p_session_token AND user_id = v_user_id AND status = 'active'
  LIMIT 1;

  IF v_session IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_session');
  END IF;

  SELECT * INTO v_settings FROM crossy_road_settings LIMIT 1;

  v_points := (p_steps * v_settings.points_per_step) + (p_coins * v_settings.bonus_coin_points);

  UPDATE crossy_road_sessions SET
    status = 'completed', score = p_score, steps_taken = p_steps,
    coins_collected = p_coins, points_awarded = v_points, ended_at = now()
  WHERE id = v_session.id;

  -- award points
  IF v_points > 0 THEN
    INSERT INTO user_points (user_id, points, source)
    VALUES (v_user_id, v_points, 'crossy_road')
    ON CONFLICT (user_id) DO UPDATE SET points = user_points.points + v_points, updated_at = now();

    INSERT INTO points_transactions (user_id, amount, type, source, description)
    VALUES (v_user_id, v_points, 'earn', 'crossy_road', 'نقاط لعبة اعبر الطريق');
  END IF;

  UPDATE crossy_road_settings SET total_points_distributed = total_points_distributed + v_points WHERE id = v_settings.id;

  RETURN jsonb_build_object('success', true, 'points_awarded', v_points, 'game_score', p_score);
END;
$$;

-- ============================================================
-- RPC 3: update_crossy_road_high_score
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_crossy_road_high_score(p_score integer, p_steps integer DEFAULT 0)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN RETURN; END IF;
  INSERT INTO crossy_road_high_scores (user_id, high_score, best_steps)
  VALUES (v_user_id, p_score, p_steps)
  ON CONFLICT (user_id) DO UPDATE SET
    high_score = GREATEST(crossy_road_high_scores.high_score, p_score),
    best_steps = GREATEST(crossy_road_high_scores.best_steps, p_steps),
    updated_at = now();
END;
$$;

-- ============================================================
-- RPC 4: check_crossy_road_milestone
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_crossy_road_milestone(p_user_id uuid, p_score integer, p_session_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_milestone record;
BEGIN
  SELECT * INTO v_milestone FROM crossy_road_milestones
  WHERE is_active AND target_score <= p_score AND claimed_count < stock
    AND id NOT IN (SELECT milestone_id FROM crossy_road_milestone_claims WHERE user_id = p_user_id)
  ORDER BY target_score DESC LIMIT 1;

  IF v_milestone IS NULL THEN
    RETURN jsonb_build_object('won', false);
  END IF;

  INSERT INTO crossy_road_milestone_claims (user_id, milestone_id, session_id) VALUES (p_user_id, v_milestone.id, p_session_id);
  UPDATE crossy_road_milestones SET claimed_count = claimed_count + 1 WHERE id = v_milestone.id;

  IF v_milestone.product_id IS NOT NULL THEN
    BEGIN PERFORM deduct_prize_stock(v_milestone.product_id, v_milestone.selected_color, v_milestone.selected_option_id); EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;

  RETURN jsonb_build_object('won', true, 'milestone_id', v_milestone.id, 'prize_name', v_milestone.prize_name_ar);
END;
$$;

-- ============================================================
-- RPC 5: claim_crossy_road_prize_to_cart
-- ============================================================
CREATE OR REPLACE FUNCTION public.claim_crossy_road_prize_to_cart(p_milestone_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_milestone record;
BEGIN
  IF v_user_id IS NULL THEN RETURN; END IF;

  SELECT * INTO v_milestone FROM crossy_road_milestones WHERE id = p_milestone_id;
  IF v_milestone IS NULL OR v_milestone.product_id IS NULL THEN RETURN; END IF;

  INSERT INTO cart_items (user_id, product_id, quantity, is_gift, is_locked, selected_color, product_option_id)
  VALUES (v_user_id, v_milestone.product_id, 1, true, true, v_milestone.selected_color, v_milestone.selected_option_id)
  ON CONFLICT DO NOTHING;
END;
$$;

-- ============================================================
-- RPC 6: admin_award_crossy_road_winners
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_award_crossy_road_winners()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prize record;
  v_hs record;
  v_awarded integer := 0;
  v_season integer;
BEGIN
  SELECT COALESCE(MAX(season), 0) INTO v_season FROM crossy_road_high_scores;

  FOR v_prize IN SELECT * FROM crossy_road_leaderboard_prizes WHERE is_active ORDER BY position LOOP
    SELECT * INTO v_hs FROM crossy_road_high_scores WHERE high_score > 0 ORDER BY high_score DESC OFFSET (v_prize.position - 1) LIMIT 1;
    IF v_hs IS NOT NULL THEN
      INSERT INTO crossy_road_winners (user_id, prize_type, prize_name_ar, position, score, season, product_id, selected_color, selected_option_id)
      VALUES (v_hs.user_id, 'leaderboard', v_prize.prize_name_ar, v_prize.position, v_hs.high_score, v_season, v_prize.product_id, v_prize.selected_color, v_prize.selected_option_id);

      IF v_prize.product_id IS NOT NULL THEN
        INSERT INTO cart_items (user_id, product_id, quantity, is_gift, is_locked, selected_color, product_option_id)
        VALUES (v_hs.user_id, v_prize.product_id, 1, true, true, v_prize.selected_color, v_prize.selected_option_id)
        ON CONFLICT DO NOTHING;
        BEGIN PERFORM deduct_prize_stock(v_prize.product_id, v_prize.selected_color, v_prize.selected_option_id); EXCEPTION WHEN OTHERS THEN NULL; END;
      END IF;

      v_awarded := v_awarded + 1;
    END IF;
  END LOOP;

  -- reset scores
  UPDATE crossy_road_high_scores SET high_score = 0, best_steps = 0, season = v_season + 1, updated_at = now();

  RETURN jsonb_build_object('success', true, 'winners_awarded', v_awarded);
END;
$$;
