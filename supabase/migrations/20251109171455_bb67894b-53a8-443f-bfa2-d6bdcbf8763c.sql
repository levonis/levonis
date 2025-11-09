-- إنشاء bucket للصور والفيديوهات الخاصة بالتقييمات
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'review-media',
  'review-media',
  true,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm']
)
ON CONFLICT (id) DO NOTHING;

-- إضافة عمود media_files لجدول reviews
ALTER TABLE reviews 
ADD COLUMN IF NOT EXISTS media_files TEXT[] DEFAULT ARRAY[]::TEXT[];

-- RLS policies لـ bucket
CREATE POLICY "Users can upload review media" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'review-media' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Anyone can view review media" ON storage.objects
FOR SELECT
USING (bucket_id = 'review-media');

CREATE POLICY "Users can delete their own review media" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'review-media' AND
  (storage.foldername(name))[1] = auth.uid()::text
);