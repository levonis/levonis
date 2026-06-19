CREATE POLICY "Assistants can manage product options"
ON public.product_options
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'assistant'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'assistant'::public.app_role));