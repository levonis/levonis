
CREATE OR REPLACE FUNCTION public.end_stack_game(p_session_id uuid, p_session_token text, p_score integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_session stack_game_sessions%ROWTYPE;
  v_settings stack_game_settings%ROWTYPE;
  v_website_points integer;
  v_points_per_block numeric;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO v_session FROM stack_game_sessions
  WHERE id = p_session_id AND user_id = v_user_id AND session_token = p_session_token AND status = 'active';

  IF v_session IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_session');
  END IF;

  SELECT * INTO v_settings FROM stack_game_settings LIMIT 1;

  v_points_per_block := COALESCE(v_settings.points_per_block, 1);
  v_website_points := FLOOR(p_score * v_points_per_block);

  -- Guarantee at least 1 website point if the player placed any blocks
  IF p_score > 0 AND v_website_points < 1 THEN
    v_website_points := 1;
  END IF;

  UPDATE stack_game_sessions
  SET status = 'completed', score = p_score, ended_at = now(), website_points_earned = v_website_points
  WHERE id = p_session_id;

  IF v_website_points > 0 THEN
    INSERT INTO user_points (user_id, available_points, total_points)
    VALUES (v_user_id, v_website_points, v_website_points)
    ON CONFLICT (user_id) DO UPDATE
    SET available_points = user_points.available_points + v_website_points,
        total_points = user_points.total_points + v_website_points,
        updated_at = now();
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'score', p_score,
    'website_points', v_website_points
  );
END;
$$;
