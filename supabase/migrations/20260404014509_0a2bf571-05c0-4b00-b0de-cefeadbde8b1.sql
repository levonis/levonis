
-- Table to track VIP Plus free daily game plays
CREATE TABLE public.vip_free_game_plays (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  game_type text NOT NULL,
  played_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, game_type, played_date)
);

ALTER TABLE public.vip_free_game_plays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own free plays"
ON public.vip_free_game_plays FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own free plays"
ON public.vip_free_game_plays FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Function to check if user has VIP Plus free play available
CREATE OR REPLACE FUNCTION public.check_vip_free_play(
  p_user_id uuid,
  p_game_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_card RECORD;
  v_level RECORD;
  v_played_today boolean;
BEGIN
  -- Check if user has active VIP Plus card
  SELECT uc.*, ll.is_vip_plus, ll.free_daily_games
  INTO v_card
  FROM user_cards uc
  JOIN loyalty_levels ll ON ll.id = uc.level_id
  WHERE uc.user_id = p_user_id
    AND uc.is_active = true
    AND uc.expires_at > now()
    AND ll.is_vip_plus = true
    AND ll.free_daily_games > 0;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('has_free_play', false);
  END IF;

  -- Check if already played today
  SELECT EXISTS(
    SELECT 1 FROM vip_free_game_plays
    WHERE user_id = p_user_id
      AND game_type = p_game_type
      AND played_date = CURRENT_DATE
  ) INTO v_played_today;

  IF v_played_today THEN
    RETURN jsonb_build_object('has_free_play', false, 'reason', 'already_played_today');
  END IF;

  RETURN jsonb_build_object('has_free_play', true, 'free_daily_games', v_card.free_daily_games);
END;
$$;

-- Function to use a free play
CREATE OR REPLACE FUNCTION public.use_vip_free_play(
  p_user_id uuid,
  p_game_type text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_check jsonb;
BEGIN
  v_check := check_vip_free_play(p_user_id, p_game_type);
  
  IF NOT (v_check->>'has_free_play')::boolean THEN
    RETURN false;
  END IF;

  INSERT INTO vip_free_game_plays (user_id, game_type, played_date)
  VALUES (p_user_id, p_game_type, CURRENT_DATE)
  ON CONFLICT (user_id, game_type, played_date) DO NOTHING;

  RETURN true;
END;
$$;
