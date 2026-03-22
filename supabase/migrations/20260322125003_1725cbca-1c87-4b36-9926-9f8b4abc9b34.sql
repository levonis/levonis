CREATE OR REPLACE FUNCTION public.start_stack_game()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_settings stack_game_settings%ROWTYPE;
  v_ticket_count integer;
  v_session_token text;
  v_session_id uuid;
  v_today_plays integer;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO v_settings FROM stack_game_settings LIMIT 1;

  IF v_settings IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'game_disabled');
  END IF;

  IF NOT v_settings.game_enabled THEN
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
$$;