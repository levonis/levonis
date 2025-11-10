-- Add image_url column to messages table for image attachments
ALTER TABLE messages ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Create storage bucket for chat images
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-images', 'chat-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for chat images bucket
CREATE POLICY "Users can upload their chat images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'chat-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Anyone can view chat images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'chat-images');

CREATE POLICY "Users can delete their own chat images"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'chat-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins can delete any chat images"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'chat-images' AND
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'::app_role
  )
);