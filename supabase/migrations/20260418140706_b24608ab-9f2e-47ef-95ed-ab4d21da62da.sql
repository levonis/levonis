
-- Fix VIP+ free daily play limit (one per game per day)
-- Record free play usage in start_crossy_road, and add VIP free play support
-- to start_knife_rain and start_stack_game with proper recording.

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
  v_free jsonb;
  v_has_free boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO v_settings FROM crossy_road_settings LIMIT 1;
  IF NOT v_settings.game_enabled THEN
    RETURN jsonb_build_object('success', false, 'error', 'game_disabled');
  END IF;

  UPDATE crossy_road_sessions
  SET status = 'abandoned', ended_at = now()
  WHERE user_id = v_user_id AND status = 'active';

  BEGIN
    v_free := check_vip_free_play(v_user_id, 'crossy_road');
    v_has_free := COALESCE((v_free->>'has_free_play')::boolean, false);
  EXCEPTION WHEN OTHERS THEN v_has_free := false;
  END;

  IF v_settings.max_daily_plays IS NOT NULL THEN
    SELECT count(*) INTO v_today_plays FROM crossy_road_sessions
    WHERE user_id = v_user_id AND started_at >= date_trunc('day', now());
    IF v_today_plays >= v_settings.max_daily_plays THEN
      RETURN jsonb_build_object('success', false, 'error', 'daily_limit_reached');
    END IF;
  END IF;

  IF v_has_free THEN
    -- Record the free play so user can't reuse it today
    INSERT INTO vip_free_game_plays (user_id, game_type, played_date)
    VALUES (v_user_id, 'crossy_road', CURRENT_DATE)
    ON CONFLICT (user_id, game_type, played_date) DO NOTHING;
  ELSE
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


CREATE OR REPLACE FUNCTION public.start_knife_rain()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_settings knife_rain_settings%ROWTYPE;
  v_ticket_count integer;
  v_session_token text;
  v_session_id uuid;
  v_today_plays integer;
  v_free jsonb;
  v_has_free boolean := false;
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

  BEGIN
    v_free := check_vip_free_play(v_user_id, 'knife_rain');
    v_has_free := COALESCE((v_free->>'has_free_play')::boolean, false);
  EXCEPTION WHEN OTHERS THEN v_has_free := false;
  END;

  IF v_has_free THEN
    INSERT INTO vip_free_game_plays (user_id, game_type, played_date)
    VALUES (v_user_id, 'knife_rain', CURRENT_DATE)
    ON CONFLICT (user_id, game_type, played_date) DO NOTHING;
  ELSE
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
  END IF;

  v_session_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public.knife_rain_sessions (user_id, session_token, status)
  VALUES (v_user_id, v_session_token, 'active')
  RETURNING id INTO v_session_id;

  RETURN jsonb_build_object('success', true, 'session_id', v_session_id, 'session_token', v_session_token);
END;
$function$;


CREATE OR REPLACE FUNCTION public.start_stack_game()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_settings stack_game_settings%ROWTYPE;
  v_ticket_count integer;
  v_session_token text;
  v_session_id uuid;
  v_today_plays integer;
  v_free jsonb;
  v_has_free boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  UPDATE public.stack_game_sessions
  SET status = 'expired', ended_at = now()
  WHERE user_id = v_user_id AND status = 'active'
    AND started_at < now() - interval '10 minutes';

  SELECT * INTO v_settings FROM stack_game_settings LIMIT 1;
  IF v_settings IS NULL OR NOT v_settings.game_enabled THEN
    RETURN jsonb_build_object('success', false, 'error', 'game_disabled');
  END IF;

  IF v_settings.max_daily_plays IS NOT NULL THEN
    SELECT count(*) INTO v_today_plays
    FROM public.stack_game_sessions
    WHERE user_id = v_user_id
      AND started_at::date = now()::date;
    IF v_today_plays >= v_settings.max_daily_plays THEN
      RETURN jsonb_build_object('success', false, 'error', 'daily_limit_reached');
    END IF;
  END IF;

  BEGIN
    v_free := check_vip_free_play(v_user_id, 'stack_game');
    v_has_free := COALESCE((v_free->>'has_free_play')::boolean, false);
  EXCEPTION WHEN OTHERS THEN v_has_free := false;
  END;

  IF v_has_free THEN
    INSERT INTO vip_free_game_plays (user_id, game_type, played_date)
    VALUES (v_user_id, 'stack_game', CURRENT_DATE)
    ON CONFLICT (user_id, game_type, played_date) DO NOTHING;
  ELSE
    SELECT ticket_count INTO v_ticket_count
    FROM public.user_tickets
    WHERE user_id = v_user_id
    FOR UPDATE;

    IF v_ticket_count IS NULL OR v_ticket_count < v_settings.entry_fee_tickets THEN
      RETURN jsonb_build_object('success', false, 'error', 'not_enough_tickets');
    END IF;

    UPDATE public.user_tickets
    SET ticket_count = ticket_count - v_settings.entry_fee_tickets,
        updated_at = now()
    WHERE user_id = v_user_id;
  END IF;

  v_session_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public.stack_game_sessions (user_id, session_token, status)
  VALUES (v_user_id, v_session_token, 'active')
  RETURNING id INTO v_session_id;

  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_session_id,
    'session_token', v_session_token
  );
END;
$function$;
