-- Drop existing UPDATE policy that allows users to modify their own points
DROP POLICY IF EXISTS "Users can update their own points" ON public.user_points;

-- Create system-only UPDATE policy (for triggers and admin functions)
-- Using SECURITY DEFINER functions for all point modifications
CREATE POLICY "System can update user points"
ON public.user_points
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Also update INSERT policy to be admin/system only
DROP POLICY IF EXISTS "System can insert user points" ON public.user_points;

CREATE POLICY "System can insert user points"
ON public.user_points
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));