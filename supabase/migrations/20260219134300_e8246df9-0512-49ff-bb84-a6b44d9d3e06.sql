-- Fix: Add INSERT policy for merchant_stores bucket (missing!)
CREATE POLICY "Authenticated users can upload merchant store images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'merchant_stores' AND (storage.foldername(name))[1] = (auth.uid())::text);
