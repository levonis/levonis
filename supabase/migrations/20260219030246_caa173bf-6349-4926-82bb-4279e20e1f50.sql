-- Remove the overly permissive upload policy - admins already have their own restricted policy
DROP POLICY IF EXISTS "Authenticated upload to product-images" ON storage.objects;