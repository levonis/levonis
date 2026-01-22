-- Remove the second-hand marketplace (listings/files) while KEEPING messaging UI (listing_conversations/listing_messages)
-- Drop listing-related tables
DROP TABLE IF EXISTS public.listing_views CASCADE;
DROP TABLE IF EXISTS public.listing_likes CASCADE;
DROP TABLE IF EXISTS public.listing_favorites CASCADE;
DROP TABLE IF EXISTS public.seller_profiles CASCADE;
DROP TABLE IF EXISTS public.user_listings CASCADE;

-- Remove listing images bucket + its objects (we will reuse existing chat media bucket for messages)
DELETE FROM storage.objects WHERE bucket_id = 'listing-images';
DELETE FROM storage.buckets WHERE id = 'listing-images';
