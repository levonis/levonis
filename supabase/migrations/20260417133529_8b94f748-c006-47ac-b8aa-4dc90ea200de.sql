CREATE POLICY "Admins can view all user cards"
  ON public.user_cards FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update all user cards"
  ON public.user_cards FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete user cards"
  ON public.user_cards FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));