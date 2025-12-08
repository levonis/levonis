-- Drop existing overly permissive INSERT policy
DROP POLICY IF EXISTS "System can insert transactions" ON public.points_transactions;

-- Create admin-only INSERT policy
-- All legitimate point transactions occur through SECURITY DEFINER triggers
CREATE POLICY "Admins can insert transactions"
ON public.points_transactions
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));