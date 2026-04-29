ALTER TABLE public.crossy_road_winners REPLICA IDENTITY FULL;
ALTER TABLE public.stack_game_winners REPLICA IDENTITY FULL;
ALTER TABLE public.competition_prizes REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.crossy_road_winners;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stack_game_winners;
ALTER PUBLICATION supabase_realtime ADD TABLE public.competition_prizes;