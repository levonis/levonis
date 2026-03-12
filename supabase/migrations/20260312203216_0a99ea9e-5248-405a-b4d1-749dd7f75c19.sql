
-- Drop overly permissive policies and replace with role-based ones
DROP POLICY IF EXISTS "Auth users can manage mystery case settings" ON public.mystery_case_settings;
DROP POLICY IF EXISTS "Auth users can manage mystery case rewards" ON public.mystery_case_rewards;

-- Only admins can manage settings
CREATE POLICY "Admins can manage mystery case settings"
  ON public.mystery_case_settings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Only admins can manage rewards
CREATE POLICY "Admins can manage mystery case rewards"
  ON public.mystery_case_rewards FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Re-add read-only for all authenticated (needed alongside the admin ALL policy)
-- The existing SELECT policies already cover this
