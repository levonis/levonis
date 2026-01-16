-- Create uploads bucket for banners and general uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('uploads', 'uploads', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

-- Allow public read access
CREATE POLICY "Allow public read access on uploads"
ON storage.objects FOR SELECT
USING (bucket_id = 'uploads');

-- Allow authenticated users to upload
CREATE POLICY "Allow authenticated users to upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'uploads');

-- Allow authenticated users to update their uploads
CREATE POLICY "Allow authenticated users to update uploads"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'uploads');

-- Allow authenticated users to delete their uploads
CREATE POLICY "Allow authenticated users to delete uploads"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'uploads');