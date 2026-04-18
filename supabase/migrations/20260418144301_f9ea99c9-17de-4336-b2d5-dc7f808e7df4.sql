-- Allow public read of partial_payment_settings only (used for live direct-sale price computation)
CREATE POLICY "Public can view partial payment settings"
ON public.default_settings
FOR SELECT
TO anon, authenticated
USING (setting_key = 'partial_payment_settings');