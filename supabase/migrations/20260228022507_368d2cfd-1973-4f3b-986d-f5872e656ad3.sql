
-- Create storage bucket for merchant review media
INSERT INTO storage.buckets (id, name, public) VALUES ('merchant-reviews', 'merchant-reviews', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload review media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'merchant-reviews');

-- Public read
CREATE POLICY "Public read review media"
ON storage.objects FOR SELECT
USING (bucket_id = 'merchant-reviews');

-- Users can delete their own uploads
CREATE POLICY "Users can delete own review media"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'merchant-reviews' AND auth.uid()::text = (storage.foldername(name))[1]);
