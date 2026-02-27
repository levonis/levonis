
-- Drop the overly permissive policy on admin_telegram_context
DROP POLICY IF EXISTS "Service role can manage admin_telegram_context" ON public.admin_telegram_context;

-- Replace with admin-only policy
CREATE POLICY "Admins can manage admin_telegram_context"
ON public.admin_telegram_context
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
