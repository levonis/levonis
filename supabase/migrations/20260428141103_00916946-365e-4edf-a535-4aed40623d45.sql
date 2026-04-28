
DROP POLICY IF EXISTS "Anyone can view order files" ON storage.objects;

CREATE POLICY "Order owner can view own order files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'order-files'
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = (split_part(storage.objects.name, '/', 1))::uuid
      AND o.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can view order files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'order-files'
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  )
);

DROP POLICY IF EXISTS "Anyone can read ad bookings" ON public.merchant_ad_bookings;

CREATE POLICY "Owner can read own ad bookings"
ON public.merchant_ad_bookings
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Merchant can read their ad bookings"
ON public.merchant_ad_bookings
FOR SELECT
TO authenticated
USING (auth.uid()::text = merchant_id);

CREATE POLICY "Admins can read all ad bookings"
ON public.merchant_ad_bookings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  )
);
