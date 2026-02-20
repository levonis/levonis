
-- Fix 1: Remove duplicate notification trigger (JS code handles notifications better)
DROP TRIGGER IF EXISTS on_new_listing_message ON listing_messages;

-- Fix 2: Allow audio and document MIME types in product-images bucket for chat
UPDATE storage.buckets 
SET 
  allowed_mime_types = ARRAY[
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/mpeg',
    'audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/aac',
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ],
  file_size_limit = 20971520  -- 20MB for audio/video/docs
WHERE name = 'product-images';

-- Fix 3: Add permissive upload policy for chat/* path
-- Existing policies check foldername[2] = auth.uid(), but chat path is chat/listing/userId/...
-- We need a policy that allows uploads to chat/ subdirectory

CREATE POLICY "Users can upload chat media in product-images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images' 
  AND (storage.foldername(name))[1] = 'chat'
  AND (storage.foldername(name))[3] = auth.uid()::text
);

CREATE POLICY "Users can delete own chat media in product-images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'product-images' 
  AND (storage.foldername(name))[1] = 'chat'
  AND (storage.foldername(name))[3] = auth.uid()::text
);
