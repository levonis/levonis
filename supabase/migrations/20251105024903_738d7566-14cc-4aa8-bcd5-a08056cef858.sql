-- Security: Add file type and size restrictions to storage buckets
-- This prevents unrestricted file uploads that could be exploited

-- Restrict custom-product-images bucket to images only with 5MB limit
UPDATE storage.buckets 
SET 
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
  file_size_limit = 5242880  -- 5MB in bytes
WHERE name = 'custom-product-images';

-- Restrict product-images bucket to images only with 5MB limit
UPDATE storage.buckets 
SET 
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
  file_size_limit = 5242880  -- 5MB in bytes
WHERE name = 'product-images';