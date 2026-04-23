
-- Add media columns to categories table
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS media_url TEXT,
  ADD COLUMN IF NOT EXISTS media_type TEXT; -- 'image' | 'gif' | 'video'

-- Create public bucket for category media
INSERT INTO storage.buckets (id, name, public)
VALUES ('category-media', 'category-media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DROP POLICY IF EXISTS "Category media public read" ON storage.objects;
CREATE POLICY "Category media public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'category-media');

DROP POLICY IF EXISTS "Admins can upload category media" ON storage.objects;
CREATE POLICY "Admins can upload category media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'category-media' AND public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update category media" ON storage.objects;
CREATE POLICY "Admins can update category media"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'category-media' AND public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete category media" ON storage.objects;
CREATE POLICY "Admins can delete category media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'category-media' AND public.has_role(auth.uid(), 'admin'::app_role));
