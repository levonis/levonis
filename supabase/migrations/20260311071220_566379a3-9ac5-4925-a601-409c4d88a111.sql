
-- Create storage bucket for bundle images
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('bundle-images', 'bundle-images', true, 5242880)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to view bundle images
CREATE POLICY "Public read bundle images" ON storage.objects
FOR SELECT USING (bucket_id = 'bundle-images');

-- Allow authenticated users to upload bundle images (admin will be authenticated)
CREATE POLICY "Auth upload bundle images" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'bundle-images');

-- Allow authenticated users to update bundle images
CREATE POLICY "Auth update bundle images" ON storage.objects
FOR UPDATE TO authenticated USING (bucket_id = 'bundle-images');

-- Allow authenticated users to delete bundle images
CREATE POLICY "Auth delete bundle images" ON storage.objects
FOR DELETE TO authenticated USING (bucket_id = 'bundle-images');
