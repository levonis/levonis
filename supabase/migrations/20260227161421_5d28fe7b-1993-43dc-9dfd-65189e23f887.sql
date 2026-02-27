
-- Create wish-images storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('wish-images', 'wish-images', true);

-- Allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload wish images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'wish-images');

-- Allow public read access
CREATE POLICY "Anyone can view wish images"
ON storage.objects FOR SELECT
USING (bucket_id = 'wish-images');

-- Allow users to update their own uploads
CREATE POLICY "Users can update their own wish images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'wish-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to delete their own uploads
CREATE POLICY "Users can delete their own wish images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'wish-images' AND auth.uid()::text = (storage.foldername(name))[1]);
