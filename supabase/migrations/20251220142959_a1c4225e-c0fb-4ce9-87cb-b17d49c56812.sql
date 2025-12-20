-- Fix saved_invoices: Remove duplicate public policies and keep only authenticated ones
DROP POLICY IF EXISTS "Admins can delete saved invoices" ON public.saved_invoices;
DROP POLICY IF EXISTS "Admins can update saved invoices" ON public.saved_invoices;
DROP POLICY IF EXISTS "Admins can view all saved invoices" ON public.saved_invoices;
DROP POLICY IF EXISTS "Users can view their saved invoices" ON public.saved_invoices;
DROP POLICY IF EXISTS "Admins can create invoices" ON public.saved_invoices;
DROP POLICY IF EXISTS "Admins can insert saved invoices" ON public.saved_invoices;
DROP POLICY IF EXISTS "Admins can update invoices" ON public.saved_invoices;
DROP POLICY IF EXISTS "Admins can view all invoices" ON public.saved_invoices;
DROP POLICY IF EXISTS "Users can view their own invoices" ON public.saved_invoices;

-- Recreate with proper TO authenticated
CREATE POLICY "Admins can manage saved invoices"
ON public.saved_invoices
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own invoices"
ON public.saved_invoices
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM orders
  WHERE orders.id = saved_invoices.order_id
  AND orders.user_id = auth.uid()
));