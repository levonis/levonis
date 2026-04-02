CREATE POLICY "Admins can update space_blaster_settings"
ON public.space_blaster_settings
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));