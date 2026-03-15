
-- Add auto-rating and purchase count columns to merchant_ratings
ALTER TABLE public.merchant_ratings 
  ADD COLUMN IF NOT EXISTS is_auto_rating boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS purchase_count integer NOT NULL DEFAULT 1;
