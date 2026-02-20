-- Add delivery price to merchant public profiles
ALTER TABLE public.merchant_public_profiles 
ADD COLUMN IF NOT EXISTS delivery_price_iqd integer DEFAULT 0;