
ALTER TABLE public.stack_game_milestones 
  ADD COLUMN IF NOT EXISTS selected_color TEXT,
  ADD COLUMN IF NOT EXISTS selected_option_id UUID;

ALTER TABLE public.stack_game_leaderboard_prizes 
  ADD COLUMN IF NOT EXISTS selected_color TEXT,
  ADD COLUMN IF NOT EXISTS selected_option_id UUID;

ALTER TABLE public.stack_game_winners 
  ADD COLUMN IF NOT EXISTS selected_color TEXT,
  ADD COLUMN IF NOT EXISTS selected_option_id UUID;
