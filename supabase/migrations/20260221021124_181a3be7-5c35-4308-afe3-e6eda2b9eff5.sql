
-- Allow merchants to update their own public profile
CREATE POLICY "Merchants can update their own public profile"
ON public.merchant_public_profiles
FOR UPDATE
USING (id IN (SELECT id FROM public.merchant_applications WHERE user_id = auth.uid()))
WITH CHECK (id IN (SELECT id FROM public.merchant_applications WHERE user_id = auth.uid()));

-- Allow approved merchants to update their own application (settings like store_layout, specialty, etc.)
CREATE POLICY "Approved merchants can update their own application settings"
ON public.merchant_applications
FOR UPDATE
USING (auth.uid() = user_id AND status = 'approved')
WITH CHECK (auth.uid() = user_id AND status = 'approved');
