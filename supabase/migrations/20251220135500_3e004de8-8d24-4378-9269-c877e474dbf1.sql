-- Fix coupons table RLS - add TO authenticated
DROP POLICY IF EXISTS "Only admins can manage coupons" ON public.coupons;

CREATE POLICY "Only admins can manage coupons" 
ON public.coupons 
FOR ALL 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));