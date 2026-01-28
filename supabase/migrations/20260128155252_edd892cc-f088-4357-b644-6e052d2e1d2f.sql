-- 1. Fix the recursive trigger by adding a guard
CREATE OR REPLACE FUNCTION public.sync_merchant_from_profile()
RETURNS TRIGGER AS $$
BEGIN
  -- Only sync if relevant fields actually changed
  IF (TG_OP = 'UPDATE') AND 
     (OLD.avatar_url IS NOT DISTINCT FROM NEW.avatar_url) AND 
     (OLD.selected_frame_id IS NOT DISTINCT FROM NEW.selected_frame_id) THEN
    RETURN NEW;
  END IF;

  -- When profile is updated, sync relevant fields to merchant_public_profiles
  UPDATE public.merchant_public_profiles
  SET 
    store_image_url = COALESCE(NEW.avatar_url, store_image_url),
    selected_frame_id = COALESCE(NEW.selected_frame_id, selected_frame_id),
    updated_at = now()
  WHERE id = NEW.id;
  
  -- Also update merchant_applications
  UPDATE public.merchant_applications
  SET 
    store_image_url = COALESCE(NEW.avatar_url, store_image_url),
    selected_frame_id = COALESCE(NEW.selected_frame_id, selected_frame_id)
  WHERE user_id = NEW.id AND status = 'approved';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Fix rate limit trigger to prevent recursion
CREATE OR REPLACE FUNCTION public.rate_limit_profile_update()
RETURNS TRIGGER AS $$
DECLARE
  last_update TIMESTAMP;
BEGIN
  -- Skip rate limiting for certain fields to prevent issues
  IF (OLD.avatar_url IS NOT DISTINCT FROM NEW.avatar_url) AND 
     (OLD.selected_frame_id IS NOT DISTINCT FROM NEW.selected_frame_id) AND
     (OLD.full_name IS NOT DISTINCT FROM NEW.full_name) AND
     (OLD.username IS NOT DISTINCT FROM NEW.username) AND
     (OLD.phone_number IS NOT DISTINCT FROM NEW.phone_number) AND
     (OLD.bio IS NOT DISTINCT FROM NEW.bio) THEN
    RETURN NEW;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Drop and recreate the points_transactions_source_check to include all sources
ALTER TABLE public.points_transactions DROP CONSTRAINT IF EXISTS points_transactions_source_check;

ALTER TABLE public.points_transactions ADD CONSTRAINT points_transactions_source_check 
CHECK (source = ANY (ARRAY[
  'order'::text, 
  'order_delivered'::text, 
  'review'::text, 
  'coupon'::text, 
  'cash'::text, 
  'daily_task'::text, 
  'referral'::text, 
  'referred'::text, 
  'verified_review'::text, 
  'wallet_conversion'::text, 
  'admin_adjustment'::text, 
  'tickets_conversion'::text, 
  'avatar_frame'::text, 
  'spend'::text,
  'frame_purchase'::text,
  'rating'::text,
  'merchant_rating'::text
]));

-- 4. Fix storage policies for product-images bucket
-- First, drop existing policies that might be conflicting
DO $$ 
BEGIN
  -- Drop if exists
  DROP POLICY IF EXISTS "Users can manage their avatar images" ON storage.objects;
  DROP POLICY IF EXISTS "Public read for product images" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can upload to avatars folder" ON storage.objects;
  DROP POLICY IF EXISTS "Allow authenticated uploads to product-images" ON storage.objects;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Create proper storage policies
CREATE POLICY "Public read for product-images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated upload to product-images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Users can update own files in product-images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'product-images' AND (storage.foldername(name))[2] = auth.uid()::text);

CREATE POLICY "Users can delete own files in product-images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'product-images' AND (storage.foldername(name))[2] = auth.uid()::text);

-- 5. Fix merchant_stores bucket policies
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Merchants can upload store images" ON storage.objects;
  DROP POLICY IF EXISTS "Public read merchant stores" ON storage.objects;
  DROP POLICY IF EXISTS "Merchants can manage their store images" ON storage.objects;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Public read merchant-stores"
ON storage.objects FOR SELECT
USING (bucket_id = 'merchant_stores');

CREATE POLICY "Merchants can upload to merchant-stores"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'merchant_stores');

CREATE POLICY "Merchants can update own merchant-stores files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'merchant_stores' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Merchants can delete own merchant-stores files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'merchant_stores' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 6. Fix print-request-files bucket policies
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can upload print request files" ON storage.objects;
  DROP POLICY IF EXISTS "Public read print-request-files" ON storage.objects;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Public read print-request-files"
ON storage.objects FOR SELECT
USING (bucket_id = 'print-request-files');

CREATE POLICY "Authenticated upload print-request-files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'print-request-files');

CREATE POLICY "Users update own print-request-files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'print-request-files' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users delete own print-request-files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'print-request-files' AND (storage.foldername(name))[1] = auth.uid()::text);