
-- Stack game settings table
CREATE TABLE public.stack_game_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_enabled boolean NOT NULL DEFAULT true,
  entry_fee_tickets integer NOT NULL DEFAULT 2,
  points_per_block integer NOT NULL DEFAULT 1,
  perfect_bonus_points integer NOT NULL DEFAULT 3,
  combo_bonus_multiplier numeric NOT NULL DEFAULT 0.5,
  max_daily_plays integer DEFAULT NULL,
  total_plays bigint NOT NULL DEFAULT 0,
  total_points_distributed bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Insert default settings
INSERT INTO public.stack_game_settings (game_enabled, entry_fee_tickets, points_per_block, perfect_bonus_points)
VALUES (true, 2, 1, 3);

-- Stack game sessions for server-side score validation
CREATE TABLE public.stack_game_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_token text NOT NULL UNIQUE,
  score integer NOT NULL DEFAULT 0,
  perfect_count integer NOT NULL DEFAULT 0,
  max_combo integer NOT NULL DEFAULT 0,
  points_awarded integer DEFAULT NULL,
  status text NOT NULL DEFAULT 'active',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz DEFAULT NULL
);

-- Enable RLS
ALTER TABLE public.stack_game_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stack_game_sessions ENABLE ROW LEVEL SECURITY;

-- Settings: anyone can read
CREATE POLICY "Anyone can read stack settings" ON public.stack_game_settings FOR SELECT USING (true);
-- Settings: admin update via has_role
CREATE POLICY "Admins can update stack settings" ON public.stack_game_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Sessions: users can read own
CREATE POLICY "Users can read own sessions" ON public.stack_game_sessions FOR SELECT TO authenticated USING (user_id = auth.uid());
-- Sessions: users can insert own
CREATE POLICY "Users can insert own sessions" ON public.stack_game_sessions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
-- Sessions: users can update own active sessions
CREATE POLICY "Users can update own sessions" ON public.stack_game_sessions FOR UPDATE TO authenticated USING (user_id = auth.uid() AND status = 'active');

-- RPC: Start stack game (deduct tickets, create session)
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
  
  IF NOT v_settings.game_enabled THEN
    RETURN jsonb_build_object('success', false, 'error', 'game_disabled');
  END IF;

  -- Check daily limit
  IF v_settings.max_daily_plays IS NOT NULL THEN
    SELECT count(*) INTO v_today_plays
    FROM stack_game_sessions
    WHERE user_id = v_user_id AND started_at::date = now()::date;
    
    IF v_today_plays >= v_settings.max_daily_plays THEN
      RETURN jsonb_build_object('success', false, 'error', 'daily_limit_reached');
    END IF;
  END IF;

  -- Check tickets
  SELECT ticket_count INTO v_ticket_count
  FROM user_tickets
  WHERE user_id = v_user_id
  FOR UPDATE;

  IF v_ticket_count IS NULL OR v_ticket_count < v_settings.entry_fee_tickets THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_enough_tickets');
  END IF;

  -- Deduct tickets
  UPDATE user_tickets
  SET ticket_count = ticket_count - v_settings.entry_fee_tickets,
      updated_at = now()
  WHERE user_id = v_user_id;

  -- Create session
  v_session_token := encode(gen_random_bytes(32), 'hex');
  
  INSERT INTO stack_game_sessions (user_id, session_token, status)
  VALUES (v_user_id, v_session_token, 'active')
  RETURNING id INTO v_session_id;

  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_session_id,
    'session_token', v_session_token
  );
END;
$$;

-- RPC: End stack game (validate and award points)
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
  v_points integer;
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

  -- Anti-cheat: check elapsed time (at least 1 second per block)
  v_elapsed_seconds := EXTRACT(EPOCH FROM (now() - v_session.started_at));
  v_max_reasonable_score := GREATEST(FLOOR(v_elapsed_seconds / 0.5)::integer, 5);
  
  IF p_score > v_max_reasonable_score THEN
    -- Cap the score
    p_score := v_max_reasonable_score;
    p_perfect_count := LEAST(p_perfect_count, p_score / 3);
  END IF;

  SELECT * INTO v_settings FROM stack_game_settings LIMIT 1;

  -- Calculate points
  v_points := p_score * v_settings.points_per_block
            + p_perfect_count * v_settings.perfect_bonus_points
            + FLOOR(p_max_combo * v_settings.combo_bonus_multiplier)::integer;

  -- Update session
  UPDATE stack_game_sessions
  SET score = p_score,
      perfect_count = p_perfect_count,
      max_combo = p_max_combo,
      points_awarded = v_points,
      status = 'completed',
      ended_at = now()
  WHERE id = v_session.id;

  -- Award points
  INSERT INTO user_points (user_id, available_points, total_earned)
  VALUES (v_user_id, v_points, v_points)
  ON CONFLICT (user_id) DO UPDATE
  SET available_points = user_points.available_points + v_points,
      total_earned = user_points.total_earned + v_points,
      updated_at = now();

  -- Update stats
  UPDATE stack_game_settings
  SET total_plays = total_plays + 1,
      total_points_distributed = total_points_distributed + v_points,
      updated_at = now()
  WHERE id = v_settings.id;

  RETURN jsonb_build_object(
    'success', true,
    'points_awarded', v_points,
    'final_score', p_score
  );
END;
$$;
