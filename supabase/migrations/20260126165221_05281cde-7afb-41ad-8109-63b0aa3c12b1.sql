-- Allow authenticated users to upload print request images
CREATE POLICY "Users can upload print request images" 
ON storage.objects 
FOR INSERT 
TO authenticated
WITH CHECK (
  bucket_id = 'product-images' 
  AND (storage.foldername(name))[1] = 'print-requests'
  AND (storage.foldername(name))[2] = auth.uid()::text
);