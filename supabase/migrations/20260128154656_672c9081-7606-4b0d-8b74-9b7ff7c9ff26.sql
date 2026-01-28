-- Fix the points_transactions source check constraint to include avatar_frame
ALTER TABLE public.points_transactions 
DROP CONSTRAINT IF EXISTS points_transactions_source_check;

ALTER TABLE public.points_transactions 
ADD CONSTRAINT points_transactions_source_check 
CHECK (source = ANY (ARRAY[
  'order', 
  'order_delivered', 
  'review', 
  'coupon', 
  'cash', 
  'daily_task', 
  'referral', 
  'referred', 
  'verified_review', 
  'wallet_conversion', 
  'admin_adjustment', 
  'tickets_conversion',
  'avatar_frame',
  'spend'
]));

-- Ensure merchant_stores bucket exists and has proper policies
INSERT INTO storage.buckets (id, name, public)
VALUES ('merchant_stores', 'merchant_stores', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop and recreate storage policies for merchant_stores
DROP POLICY IF EXISTS "Users can upload their merchant store images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view merchant store images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their merchant store images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their merchant store images" ON storage.objects;

CREATE POLICY "Users can upload their merchant store images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'merchant_stores' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Public can view merchant store images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'merchant_stores');

CREATE POLICY "Users can update their merchant store images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'merchant_stores' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their merchant store images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'merchant_stores' AND
  (storage.foldername(name))[1] = auth.uid()::text
);