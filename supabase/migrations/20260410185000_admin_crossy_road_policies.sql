-- ============================================================
-- Add missing policies for Crossy Road tables (mirrors knife_rain)
-- ============================================================

-- crossy_road_settings
CREATE POLICY "Admins can update crossy_road_settings" 
ON public.crossy_road_settings 
FOR UPDATE TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));

-- crossy_road_sessions (missing user insert/update)
CREATE POLICY "Users can insert own crossy sessions" 
ON public.crossy_road_sessions 
FOR INSERT TO authenticated 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own crossy sessions" 
ON public.crossy_road_sessions 
FOR UPDATE TO authenticated 
USING (user_id = auth.uid());

-- crossy_road_high_scores (missing user upsert/update)
CREATE POLICY "Users can upsert own crossy high scores" 
ON public.crossy_road_high_scores 
FOR INSERT TO authenticated 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own crossy high scores" 
ON public.crossy_road_high_scores 
FOR UPDATE TO authenticated 
USING (user_id = auth.uid());

-- crossy_road_milestones (missing admin manage)
CREATE POLICY "Admins can manage crossy_road_milestones" 
ON public.crossy_road_milestones 
FOR ALL TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));

-- crossy_road_milestone_claims (missing user insert)
CREATE POLICY "Users can insert own crossy milestone claims" 
ON public.crossy_road_milestone_claims 
FOR INSERT TO authenticated 
WITH CHECK (user_id = auth.uid());

-- crossy_road_leaderboard_prizes (missing admin manage)
CREATE POLICY "Admins can manage crossy_road_leaderboard_prizes" 
ON public.crossy_road_leaderboard_prizes 
FOR ALL TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));

-- crossy_road_winners (missing admin manage)
CREATE POLICY "Admins can manage crossy_road_winners" 
ON public.crossy_road_winners 
FOR ALL TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));
