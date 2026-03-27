
-- 1. store_printers: Replace public SELECT with authenticated-only
DROP POLICY IF EXISTS "Anyone can view store printers" ON public.store_printers;
CREATE POLICY "Authenticated users can view store printers"
  ON public.store_printers FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

-- 2. shipping_settings: Replace any-user UPDATE with admin-only
DROP POLICY IF EXISTS "Authenticated can update shipping settings" ON public.shipping_settings;
CREATE POLICY "Only admins can update shipping settings"
  ON public.shipping_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 3. request_edit_history: Replace public SELECT with authenticated + scoped
DROP POLICY IF EXISTS "Anyone can view edit history" ON public.request_edit_history;
CREATE POLICY "Authenticated users can view edit history"
  ON public.request_edit_history FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR user_id = auth.uid()
  );
