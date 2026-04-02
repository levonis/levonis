-- Add game points columns
ALTER TABLE public.stack_game_settings
  ADD COLUMN IF NOT EXISTS game_points_per_block integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS game_perfect_bonus integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS game_combo_multiplier numeric NOT NULL DEFAULT 1.0;

-- Update end_stack_game to calculate both game score and website points separately
CREATE OR REPLACE FUNCTION public.end_stack_game(
  p_session_token text,
  p_score integer,
  p_perfect_count integer,
  p_max_combo integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_session stack_game_sessions%ROWTYPE;
  v_settings stack_game_settings%ROWTYPE;
  v_game_score integer;
  v_website_points integer;
  v_elapsed_seconds numeric;
  v_max_reasonable_score integer;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- Get session
  SELECT * INTO v_session
  FROM stack_game_sessions
  WHERE session_token = p_session_token AND user_id = v_user_id AND status = 'active'
  FOR UPDATE;

  IF v_session.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_session');
  END IF;

  -- Anti-cheat: check elapsed time
  v_elapsed_seconds := EXTRACT(EPOCH FROM (now() - v_session.started_at));
  v_max_reasonable_score := GREATEST(FLOOR(v_elapsed_seconds / 0.5)::integer, 5);
  
  IF p_score > v_max_reasonable_score THEN
    p_score := v_max_reasonable_score;
    p_perfect_count := LEAST(p_perfect_count, p_score / 3);
  END IF;

  SELECT * INTO v_settings FROM stack_game_settings LIMIT 1;

  -- Calculate GAME score (internal game points for leaderboard)
  v_game_score := p_score * v_settings.game_points_per_block
                + p_perfect_count * v_settings.game_perfect_bonus
                + FLOOR(p_max_combo * v_settings.game_combo_multiplier)::integer;

  -- Calculate WEBSITE points (loyalty points for user balance)
  v_website_points := p_score * v_settings.points_per_block
                    + p_perfect_count * v_settings.perfect_bonus_points
                    + FLOOR(p_max_combo * v_settings.combo_bonus_multiplier)::integer;

  -- Update session with game score
  UPDATE stack_game_sessions
  SET score = v_game_score,
      perfect_count = p_perfect_count,
      max_combo = p_max_combo,
      points_awarded = v_website_points,
      status = 'completed',
      ended_at = now()
  WHERE id = v_session.id;

  -- Award website points
  IF v_website_points > 0 THEN
    INSERT INTO user_points (user_id, available_points, total_earned)
    VALUES (v_user_id, v_website_points, v_website_points)
    ON CONFLICT (user_id) DO UPDATE
    SET available_points = user_points.available_points + v_website_points,
        total_earned = user_points.total_earned + v_website_points,
        updated_at = now();
  END IF;

  -- Update stats
  UPDATE stack_game_settings
  SET total_plays = total_plays + 1,
      total_points_distributed = total_points_distributed + v_website_points,
      updated_at = now()
  WHERE id = v_settings.id;

  RETURN jsonb_build_object(
    'success', true,
    'game_score', v_game_score,
    'points_awarded', v_website_points,
    'final_score', v_game_score
  );
END;
$$;