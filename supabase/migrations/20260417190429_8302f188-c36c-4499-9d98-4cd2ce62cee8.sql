
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
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO v_session FROM crossy_road_sessions
  WHERE session_token = p_session_token AND user_id = v_user_id AND status = 'active'
  LIMIT 1;

  IF v_session IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_session');
  END IF;

  SELECT * INTO v_settings FROM crossy_road_settings LIMIT 1;

  -- Calculate the GAME SCORE shown to the player & used for leaderboards
  v_game_score := (p_steps * COALESCE(v_settings.score_per_step, 1))
                + (p_coins * COALESCE(v_settings.score_per_coin, 5));

  -- Calculate site POINTS (currency) — fall back to score multipliers if points cfg is 0
  v_points := (p_steps * COALESCE(NULLIF(v_settings.points_per_step, 0), 1))
            + (p_coins * COALESCE(NULLIF(v_settings.bonus_coin_points, 0), 5));

  -- Enforce daily points cap
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

  -- Award site points
  IF v_points > 0 THEN
    INSERT INTO user_points (user_id, points, source)
    VALUES (v_user_id, v_points, 'crossy_road')
    ON CONFLICT (user_id) DO UPDATE
      SET points = user_points.points + v_points,
          updated_at = now();

    INSERT INTO points_transactions (user_id, amount, type, source, description)
    VALUES (v_user_id, v_points, 'earn', 'crossy_road', 'نقاط لعبة اعبر الطريق');
  END IF;

  -- Update high score with the calculated game_score (not raw)
  INSERT INTO crossy_road_high_scores (user_id, high_score, best_steps, all_time_high_score)
  VALUES (v_user_id, v_game_score, p_steps, v_game_score)
  ON CONFLICT (user_id) DO UPDATE SET
    high_score = GREATEST(crossy_road_high_scores.high_score, v_game_score),
    best_steps = GREATEST(crossy_road_high_scores.best_steps, p_steps),
    all_time_high_score = GREATEST(crossy_road_high_scores.all_time_high_score, v_game_score),
    updated_at = now();

  UPDATE crossy_road_settings
    SET total_plays = total_plays + 1,
        total_points_distributed = total_points_distributed + v_points
    WHERE id = v_settings.id;

  RETURN jsonb_build_object(
    'success', true,
    'points_awarded', v_points,
    'game_score', v_game_score
  );
END;
$function$;
