-- Add badge columns to merchant_public_profiles table
ALTER TABLE public.merchant_public_profiles 
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS badge_tier TEXT NOT NULL DEFAULT 'none';

-- Add comments
COMMENT ON COLUMN public.merchant_public_profiles.is_verified IS 'شارة التوثيق الذهبية - من merchant_applications';
COMMENT ON COLUMN public.merchant_public_profiles.badge_tier IS 'مستوى شارة الطلبات: none, silver, gold, diamond_1-4, emerald';