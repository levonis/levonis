-- Fix user_points table RLS - add TO authenticated
DROP POLICY IF EXISTS "Admins can view all points" ON public.user_points;
DROP POLICY IF EXISTS "Users can view their own points" ON public.user_points;

CREATE POLICY "Users can view their own points" 
ON public.user_points 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all points" 
ON public.user_points 
FOR SELECT 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));