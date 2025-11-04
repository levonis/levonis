-- Create storage bucket for custom product request images
INSERT INTO storage.buckets (id, name, public)
VALUES ('custom-product-images', 'custom-product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for custom product images
CREATE POLICY "Anyone can view custom product images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'custom-product-images');

CREATE POLICY "Authenticated users can upload custom product images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'custom-product-images' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can update their own custom product images"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'custom-product-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own custom product images"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'custom-product-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);