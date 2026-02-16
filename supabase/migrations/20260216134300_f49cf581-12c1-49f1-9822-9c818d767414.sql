
-- Create community storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('community', 'community', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to view community files
CREATE POLICY "Public access to community files" ON storage.objects
  FOR SELECT USING (bucket_id = 'community');

-- Allow authenticated users to upload to their own folder
CREATE POLICY "Authenticated users can upload community files" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'community' AND auth.uid() IS NOT NULL);

-- Allow users to delete their own uploads
CREATE POLICY "Users can delete own community files" ON storage.objects
  FOR DELETE USING (bucket_id = 'community' AND auth.uid()::text = (storage.foldername(name))[2]);
