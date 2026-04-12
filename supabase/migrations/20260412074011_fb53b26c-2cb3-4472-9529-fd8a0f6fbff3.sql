
CREATE OR REPLACE FUNCTION public.end_crossy_road(
  p_session_id uuid,
  p_score integer,
  p_steps integer,
  p_coins integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session crossy_road_sessions%ROWTYPE;
  v_settings crossy_road_settings%ROWTYPE;
  v_user_id uuid;
  v_points integer;
  v_game_score integer;
  v_today_points integer;
  v_high crossy_road_high_scores%ROWTYPE;
  v_current_season integer;
BEGIN
  SELECT * INTO v_settings FROM crossy_road_settings LIMIT 1;
  IF v_settings IS NULL THEN
    RAISE EXCEPTION 'Game settings not found';
  END IF;

  SELECT * INTO v_session FROM crossy_road_sessions WHERE id = p_session_id AND status = 'active';
  IF v_session IS NULL THEN
    RAISE EXCEPTION 'Session not found or already ended';
  END IF;

  v_user_id := v_session.user_id;

  -- Calculate game score from score settings
  v_game_score := (p_steps * COALESCE(v_settings.score_per_step, 1))
                + (p_coins * COALESCE(v_settings.score_per_coin, 5));

  -- Calculate site points
  v_points := (p_steps * v_settings.points_per_step)
            + (p_coins * v_settings.bonus_coin_points);

  -- Check daily points limit
  IF v_settings.max_daily_points IS NOT NULL THEN
    SELECT COALESCE(SUM(points_awarded), 0) INTO v_today_points
    FROM crossy_road_sessions
    WHERE user_id = v_user_id
      AND ended_at::date = CURRENT_DATE
      AND status = 'completed';

    IF v_today_points >= v_settings.max_daily_points THEN
      v_points := 0;
    ELSIF v_today_points + v_points > v_settings.max_daily_points THEN
      v_points := v_settings.max_daily_points - v_today_points;
    END IF;
  END IF;

  -- Update session
  UPDATE crossy_road_sessions
  SET score = v_game_score,
      steps_taken = p_steps,
      coins_collected = p_coins,
      points_awarded = v_points,
      status = 'completed',
      ended_at = now()
  WHERE id = p_session_id;

  -- Award points to user
  IF v_points > 0 THEN
    UPDATE profiles SET points = points + v_points WHERE id = v_user_id;
    UPDATE crossy_road_settings
    SET total_plays = total_plays + 1,
        total_points_distributed = total_points_distributed + v_points;
  ELSE
    UPDATE crossy_road_settings SET total_plays = total_plays + 1;
  END IF;

  -- Determine current season
  v_current_season := 1;
  IF v_settings.season_ends_at IS NOT NULL AND now() < v_settings.season_ends_at THEN
    SELECT COALESCE(MAX(season), 1) INTO v_current_season
    FROM crossy_road_high_scores WHERE user_id = v_user_id;
  END IF;

  -- Update high scores
  SELECT * INTO v_high FROM crossy_road_high_scores
  WHERE user_id = v_user_id AND season = v_current_season;

  IF v_high IS NULL THEN
    INSERT INTO crossy_road_high_scores (user_id, high_score, best_steps, season, all_time_high_score)
    VALUES (v_user_id, v_game_score, p_steps, v_current_season, v_game_score);
  ELSE
    UPDATE crossy_road_high_scores
    SET high_score = GREATEST(high_score, v_game_score),
        best_steps = GREATEST(best_steps, p_steps),
        all_time_high_score = GREATEST(COALESCE(all_time_high_score, 0), v_game_score),
        updated_at = now()
    WHERE id = v_high.id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'game_score', v_game_score,
    'points_awarded', v_points,
    'steps', p_steps,
    'coins', p_coins
  );
END;
$$;
