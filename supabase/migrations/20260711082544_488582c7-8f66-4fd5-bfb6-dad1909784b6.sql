ALTER TABLE public.crossy_road_milestones
  DROP CONSTRAINT IF EXISTS crossy_road_milestones_selected_option_id_fkey,
  ADD CONSTRAINT crossy_road_milestones_selected_option_id_fkey
    FOREIGN KEY (selected_option_id) REFERENCES public.product_options(id) ON DELETE SET NULL;

ALTER TABLE public.crossy_road_leaderboard_prizes
  DROP CONSTRAINT IF EXISTS crossy_road_leaderboard_prizes_selected_option_id_fkey,
  ADD CONSTRAINT crossy_road_leaderboard_prizes_selected_option_id_fkey
    FOREIGN KEY (selected_option_id) REFERENCES public.product_options(id) ON DELETE SET NULL;

ALTER TABLE public.crossy_road_winners
  DROP CONSTRAINT IF EXISTS crossy_road_winners_selected_option_id_fkey,
  ADD CONSTRAINT crossy_road_winners_selected_option_id_fkey
    FOREIGN KEY (selected_option_id) REFERENCES public.product_options(id) ON DELETE SET NULL;