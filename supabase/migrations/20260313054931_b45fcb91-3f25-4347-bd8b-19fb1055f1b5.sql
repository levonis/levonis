CREATE TABLE public.space_blaster_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_enabled BOOLEAN NOT NULL DEFAULT true,
  entry_fee_tickets INTEGER NOT NULL DEFAULT 0,
  points_per_score NUMERIC(6,2) NOT NULL DEFAULT 0.1,
  max_points_per_game INTEGER NOT NULL DEFAULT 100,
  victory_bonus_points INTEGER NOT NULL DEFAULT 20,
  wave_bonus_points INTEGER NOT NULL DEFAULT 2,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.space_blaster_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read space_blaster_settings"
  ON public.space_blaster_settings FOR SELECT TO authenticated USING (true);

INSERT INTO public.space_blaster_settings (game_enabled, entry_fee_tickets, points_per_score, max_points_per_game, victory_bonus_points, wave_bonus_points)
VALUES (true, 2, 0.1, 100, 20, 2);