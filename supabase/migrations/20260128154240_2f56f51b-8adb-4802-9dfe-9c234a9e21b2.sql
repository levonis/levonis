-- Fix storage policies for avatar uploads
-- Allow authenticated users to upload their own avatars to product-images/avatars/
CREATE POLICY "Users can upload their own avatars"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images' 
  AND (storage.foldername(name))[1] = 'avatars'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Allow users to update their own avatars
CREATE POLICY "Users can update their own avatars"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'product-images' 
  AND (storage.foldername(name))[1] = 'avatars'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Allow users to delete their own avatars
CREATE POLICY "Users can delete their own avatars"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'product-images' 
  AND (storage.foldername(name))[1] = 'avatars'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Also add policies for merchant store images for banner/cover uploads
CREATE POLICY "Users can upload merchant store banner images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'merchant_stores' 
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- Add policy for profiles table to allow public viewing of basic profile info (for comments)
CREATE POLICY "Public can view basic profile info"
ON public.profiles
FOR SELECT
TO public
USING (true);
