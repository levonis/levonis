
-- Milestone prizes: first player to reach X points wins
CREATE TABLE public.stack_game_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_score integer NOT NULL DEFAULT 100,
  prize_name_ar text NOT NULL DEFAULT '',
  prize_description_ar text,
  prize_image_url text,
  stock integer NOT NULL DEFAULT 10,
  claimed_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Milestone claims
CREATE TABLE public.stack_game_milestone_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id uuid NOT NULL REFERENCES public.stack_game_milestones(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  session_id uuid REFERENCES public.stack_game_sessions(id),
  score_achieved integer NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(milestone_id, user_id)
);

-- Leaderboard prizes (for top positions)
CREATE TABLE public.stack_game_leaderboard_prizes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position integer NOT NULL UNIQUE,
  prize_name_ar text NOT NULL DEFAULT '',
  prize_description_ar text,
  prize_image_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- High scores table (tracks best score per user, resets on admin action)
CREATE TABLE public.stack_game_high_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  high_score integer NOT NULL DEFAULT 0,
  achieved_at timestamptz NOT NULL DEFAULT now(),
  season integer NOT NULL DEFAULT 1
);

-- Winners history
CREATE TABLE public.stack_game_winners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  prize_name_ar text NOT NULL,
  prize_type text NOT NULL DEFAULT 'leaderboard',
  position integer,
  score integer,
  season integer,
  awarded_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.stack_game_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stack_game_milestone_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stack_game_leaderboard_prizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stack_game_high_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stack_game_winners ENABLE ROW LEVEL SECURITY;

-- Everyone can read milestones, leaderboard prizes, high scores, winners
CREATE POLICY "Anyone can read milestones" ON public.stack_game_milestones FOR SELECT USING (true);
CREATE POLICY "Anyone can read milestone claims" ON public.stack_game_milestone_claims FOR SELECT USING (true);
CREATE POLICY "Anyone can read leaderboard prizes" ON public.stack_game_leaderboard_prizes FOR SELECT USING (true);
CREATE POLICY "Anyone can read high scores" ON public.stack_game_high_scores FOR SELECT USING (true);
CREATE POLICY "Anyone can read winners" ON public.stack_game_winners FOR SELECT USING (true);

-- Admin CRUD
CREATE POLICY "Admin manage milestones" ON public.stack_game_milestones FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin manage leaderboard prizes" ON public.stack_game_leaderboard_prizes FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin manage high scores" ON public.stack_game_high_scores FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin manage winners" ON public.stack_game_winners FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin manage milestone claims" ON public.stack_game_milestone_claims FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Users can insert own milestone claims
CREATE POLICY "Users can claim milestones" ON public.stack_game_milestone_claims FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Users can upsert own high scores
CREATE POLICY "Users can upsert own high scores" ON public.stack_game_high_scores FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own high scores" ON public.stack_game_high_scores FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Function to check and claim milestone after game ends
CREATE OR REPLACE FUNCTION public.check_stack_milestone(p_user_id uuid, p_score integer, p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_milestone stack_game_milestones%ROWTYPE;
  v_already_claimed boolean;
  v_result jsonb := '{"won": false}'::jsonb;
BEGIN
  -- Find active milestone where score >= target and stock available
  SELECT * INTO v_milestone
  FROM stack_game_milestones
  WHERE is_active = true AND p_score >= target_score AND claimed_count < stock
  ORDER BY target_score DESC
  LIMIT 1;

  IF v_milestone.id IS NULL THEN
    RETURN v_result;
  END IF;

  -- Check if user already claimed this milestone
  SELECT EXISTS(SELECT 1 FROM stack_game_milestone_claims WHERE milestone_id = v_milestone.id AND user_id = p_user_id)
  INTO v_already_claimed;

  IF v_already_claimed THEN
    RETURN v_result;
  END IF;

  -- Claim it
  INSERT INTO stack_game_milestone_claims (milestone_id, user_id, session_id, score_achieved)
  VALUES (v_milestone.id, p_user_id, p_session_id, p_score);

  UPDATE stack_game_milestones SET claimed_count = claimed_count + 1, updated_at = now()
  WHERE id = v_milestone.id;

  v_result := jsonb_build_object(
    'won', true,
    'prize_name', v_milestone.prize_name_ar,
    'prize_image', v_milestone.prize_image_url,
    'stock_remaining', v_milestone.stock - v_milestone.claimed_count - 1
  );

  RETURN v_result;
END;
$$;

-- Function to update high score
CREATE OR REPLACE FUNCTION public.update_stack_high_score(p_score integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_current_season integer;
BEGIN
  -- Get current season from settings or default 1
  SELECT COALESCE(
    (SELECT (setting_value->>'stack_season')::integer FROM default_settings WHERE setting_key = 'game_seasons'),
    1
  ) INTO v_current_season;

  INSERT INTO stack_game_high_scores (user_id, high_score, season, achieved_at)
  VALUES (v_user_id, p_score, v_current_season, now())
  ON CONFLICT (user_id) DO UPDATE
  SET high_score = GREATEST(stack_game_high_scores.high_score, p_score),
      achieved_at = CASE WHEN p_score > stack_game_high_scores.high_score THEN now() ELSE stack_game_high_scores.achieved_at END,
      season = v_current_season;
END;
$$;

-- Function for admin to award leaderboard winners and reset scores
CREATE OR REPLACE FUNCTION public.admin_award_stack_winners()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prize stack_game_leaderboard_prizes%ROWTYPE;
  v_player stack_game_high_scores%ROWTYPE;
  v_winners_count integer := 0;
  v_current_season integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN '{"error": "unauthorized"}'::jsonb;
  END IF;

  SELECT COALESCE(
    (SELECT (setting_value->>'stack_season')::integer FROM default_settings WHERE setting_key = 'game_seasons'),
    1
  ) INTO v_current_season;

  -- For each prize position, find the player and award
  FOR v_prize IN SELECT * FROM stack_game_leaderboard_prizes WHERE is_active = true ORDER BY position ASC
  LOOP
    SELECT * INTO v_player
    FROM stack_game_high_scores
    WHERE high_score > 0
    ORDER BY high_score DESC, achieved_at ASC
    OFFSET (v_prize.position - 1) LIMIT 1;

    IF v_player.user_id IS NOT NULL THEN
      INSERT INTO stack_game_winners (user_id, prize_name_ar, prize_type, position, score, season)
      VALUES (v_player.user_id, v_prize.prize_name_ar, 'leaderboard', v_prize.position, v_player.high_score, v_current_season);
      v_winners_count := v_winners_count + 1;
    END IF;
  END LOOP;

  -- Reset all high scores
  UPDATE stack_game_high_scores SET high_score = 0, achieved_at = now();

  -- Increment season
  INSERT INTO default_settings (setting_key, setting_value)
  VALUES ('game_seasons', jsonb_build_object('stack_season', v_current_season + 1))
  ON CONFLICT (setting_key) DO UPDATE
  SET setting_value = jsonb_build_object('stack_season', v_current_season + 1),
      updated_at = now();

  RETURN jsonb_build_object('winners_awarded', v_winners_count, 'new_season', v_current_season + 1);
END;
$$;
