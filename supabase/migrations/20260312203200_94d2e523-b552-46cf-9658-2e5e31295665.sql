
-- Allow admin writes to settings and rewards via service_role already works.
-- Add policies for authenticated admin writes (using has_role if exists, otherwise permissive for now)
-- Admin can manage settings
CREATE POLICY "Admin can manage mystery case settings"
  ON public.mystery_case_settings FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- Admin can manage rewards
CREATE POLICY "Admin can manage mystery case rewards"
  ON public.mystery_case_rewards FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- Authenticated users need insert/update/delete on settings and rewards (admin pages use anon key)
CREATE POLICY "Auth users can manage mystery case settings"
  ON public.mystery_case_settings FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Auth users can manage mystery case rewards"
  ON public.mystery_case_rewards FOR ALL
  TO authenticated USING (true) WITH CHECK (true);
