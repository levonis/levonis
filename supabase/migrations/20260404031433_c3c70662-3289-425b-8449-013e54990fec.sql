-- Add cover_image_url to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

-- Create covers storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('covers', 'covers', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for covers
CREATE POLICY "Cover images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'covers');

CREATE POLICY "Users can upload their own cover"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'covers' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own cover"
ON storage.objects FOR UPDATE
USING (bucket_id = 'covers' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own cover"
ON storage.objects FOR DELETE
USING (bucket_id = 'covers' AND auth.uid()::text = (storage.foldername(name))[1]);