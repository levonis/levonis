-- Create storage bucket for merchant product media (images + videos)
INSERT INTO storage.buckets (id, name, public)
VALUES ('merchant_product_media', 'merchant_product_media', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects for merchant_product_media bucket
-- Policy: Merchants can upload to their own merchant folder
CREATE POLICY "Merchants can upload their product media"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'merchant_product_media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Merchants can view their own media
CREATE POLICY "Merchants can view their own product media"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'merchant_product_media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Merchants can update their own media
CREATE POLICY "Merchants can update their own product media"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'merchant_product_media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Merchants can delete their own media
CREATE POLICY "Merchants can delete their own product media"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'merchant_product_media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Everyone can view public media (for active products)
CREATE POLICY "Anyone can view public product media"
ON storage.objects
FOR SELECT
USING (bucket_id = 'merchant_product_media');