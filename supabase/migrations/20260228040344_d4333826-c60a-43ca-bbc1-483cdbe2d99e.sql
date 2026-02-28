
-- Add UPDATE policy for review-media bucket (needed for upsert)
CREATE POLICY "Users can update their own review media"
ON storage.objects FOR UPDATE
USING (bucket_id = 'review-media' AND (storage.foldername(name))[1] = (auth.uid())::text);
