
-- Drop the unused 3-param overload that was created by mistake
DROP FUNCTION IF EXISTS public.end_stack_game(uuid, text, integer);

-- Fix the actual 4-param version the game calls
CREATE OR REPLACE FUNCTION public.end_stack_game(
  p_session_token text,
  p_score integer,
  p_perfect_count integer,
  p_max_combo integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

  SELECT * INTO v_session
  FROM stack_game_sessions
  WHERE session_token = p_session_token AND user_id = v_user_id AND status = 'active'
  FOR UPDATE;

  IF v_session.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_session');
  END IF;

  v_elapsed_seconds := EXTRACT(EPOCH FROM (now() - v_session.started_at));
  v_max_reasonable_score := GREATEST(FLOOR(v_elapsed_seconds / 0.5)::integer, 5);

  IF p_score > v_max_reasonable_score THEN
    p_score := v_max_reasonable_score;
    p_perfect_count := LEAST(p_perfect_count, p_score / 3);
  END IF;

  SELECT * INTO v_settings FROM stack_game_settings LIMIT 1;

  v_game_score := p_score * v_settings.game_points_per_block
                + p_perfect_count * v_settings.game_perfect_bonus
                + FLOOR(p_max_combo * v_settings.game_combo_multiplier)::integer;

  v_website_points := FLOOR(
    p_score * v_settings.points_per_block
    + p_perfect_count * v_settings.perfect_bonus_points
    + p_max_combo * v_settings.combo_bonus_multiplier
  )::integer;

  -- Guarantee at least 1 website point if the player placed any blocks
  IF p_score > 0 AND v_website_points < 1 THEN
    v_website_points := 1;
  END IF;

  UPDATE stack_game_sessions
  SET score = v_game_score,
      perfect_count = p_perfect_count,
      max_combo = p_max_combo,
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

  UPDATE stack_game_settings
  SET total_plays = total_plays + 1,
      total_points_distributed = total_points_distributed + v_website_points,
      updated_at = now()
  WHERE id = v_settings.id;

  RETURN jsonb_build_object(
    'success', true,
    'game_score', v_game_score,
    'points_awarded', v_website_points,
    'final_score', v_game_score,
    'session_id', v_session.id
  );
END;
$$;
