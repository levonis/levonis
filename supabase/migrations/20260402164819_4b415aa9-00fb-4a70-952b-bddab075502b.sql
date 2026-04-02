ALTER TABLE public.stack_game_settings
  ALTER COLUMN perfect_bonus_points TYPE numeric USING perfect_bonus_points::numeric;