-- Drop the overly permissive INSERT policy
DROP POLICY IF EXISTS "System can insert saved invoices" ON public.saved_invoices;

-- Create a new policy that requires admin role for inserts
CREATE POLICY "Admins can insert saved invoices"
ON public.saved_invoices
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));