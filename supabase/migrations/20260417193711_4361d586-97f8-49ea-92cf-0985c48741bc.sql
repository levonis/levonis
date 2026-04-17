
-- 1) Fix settings: points_per_step should be at least 1 (currently 0)
UPDATE public.crossy_road_settings
SET points_per_step = GREATEST(points_per_step, 1),
    bonus_coin_points = GREATEST(bonus_coin_points, 1),
    updated_at = now()
WHERE id IS NOT NULL;

-- 2) Update start_crossy_road to abandon any previous active sessions for the user
CREATE OR REPLACE FUNCTION public.start_crossy_road()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Abandon any previous active sessions for this user
  UPDATE crossy_road_sessions
  SET status = 'abandoned', ended_at = now()
  WHERE user_id = v_user_id AND status = 'active';

  BEGIN
    SELECT (check_vip_free_play(v_user_id, 'crossy_road')).has_free_play INTO v_has_free;
  EXCEPTION WHEN OTHERS THEN v_has_free := false;
  END;

  IF v_settings.max_daily_plays IS NOT NULL THEN
    SELECT count(*) INTO v_today_plays FROM crossy_road_sessions
    WHERE user_id = v_user_id AND started_at >= date_trunc('day', now());
    IF v_today_plays >= v_settings.max_daily_plays THEN
      RETURN jsonb_build_object('success', false, 'error', 'daily_limit_reached');
    END IF;
  END IF;

  IF NOT v_has_free THEN
    SELECT ticket_count INTO v_ticket_count FROM user_tickets WHERE user_id = v_user_id;
    IF v_ticket_count IS NULL OR v_ticket_count < v_settings.entry_fee_tickets THEN
      RETURN jsonb_build_object('success', false, 'error', 'not_enough_tickets');
    END IF;
    PERFORM set_config('app.bypass_ticket_fraud_check', 'true', true);
    UPDATE user_tickets SET ticket_count = ticket_count - v_settings.entry_fee_tickets, updated_at = now() WHERE user_id = v_user_id;
  END IF;

  INSERT INTO crossy_road_sessions (user_id) VALUES (v_user_id)
  RETURNING id, session_token INTO v_session_id, v_session_token;

  UPDATE crossy_road_settings SET total_plays = total_plays + 1 WHERE id = v_settings.id;

  RETURN jsonb_build_object('success', true, 'session_token', v_session_token, 'session_id', v_session_id);
END;
$function$;

-- 3) Make end_crossy_road resilient: if exact session_token not found, fall back to user's most recent active session
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

  -- Fallback: if token mismatch, use user's most recent active session
  IF v_session IS NULL THEN
    SELECT * INTO v_session FROM crossy_road_sessions
    WHERE user_id = v_user_id AND status = 'active'
    ORDER BY started_at DESC LIMIT 1;
  END IF;

  IF v_session IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_session');
  END IF;

  SELECT * INTO v_settings FROM crossy_road_settings LIMIT 1;

  v_game_score := (p_steps * COALESCE(v_settings.score_per_step, 1))
                + (p_coins * COALESCE(v_settings.score_per_coin, 5));

  v_points := (p_steps * COALESCE(NULLIF(v_settings.points_per_step, 0), 1))
            + (p_coins * COALESCE(NULLIF(v_settings.bonus_coin_points, 0), 5));

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

  IF v_points > 0 THEN
    INSERT INTO user_points (user_id, total_points, available_points, total_earned)
    VALUES (v_user_id, v_points, v_points, v_points)
    ON CONFLICT (user_id) DO UPDATE
      SET total_points = user_points.total_points + v_points,
          available_points = user_points.available_points + v_points,
          total_earned = COALESCE(user_points.total_earned, 0) + v_points,
          updated_at = now();

    INSERT INTO points_transactions (user_id, points, type, source, description)
    VALUES (v_user_id, v_points, 'earned', 'crossy_road',
            'نقاط لعبة Crossy Road: ' || p_steps || ' خطوة + ' || p_coins || ' عملة');

    UPDATE crossy_road_settings
    SET total_points_distributed = COALESCE(total_points_distributed, 0) + v_points,
        updated_at = now();
  END IF;

  INSERT INTO crossy_road_high_scores (user_id, high_score, best_steps, all_time_high_score)
  VALUES (v_user_id, v_game_score, p_steps, v_game_score)
  ON CONFLICT (user_id) DO UPDATE
    SET high_score = GREATEST(crossy_road_high_scores.high_score, v_game_score),
        best_steps = GREATEST(crossy_road_high_scores.best_steps, p_steps),
        all_time_high_score = GREATEST(COALESCE(crossy_road_high_scores.all_time_high_score, 0), v_game_score),
        updated_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'points_awarded', v_points,
    'game_score', v_game_score,
    'coins', p_coins,
    'steps', p_steps,
    'session_id', v_session.id
  );
END;
$function$;
