
-- Allow anyone to view user_points level (needed for LevelBadge in reviews)
CREATE POLICY "Anyone can view user levels"
ON public.user_points
FOR SELECT
USING (true);

-- Drop the restrictive old select policy since the new one is more permissive
DROP POLICY IF EXISTS "user_points_select_own" ON public.user_points;
