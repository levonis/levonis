
-- Make merchant_id nullable so admin can upload reels without a merchant
ALTER TABLE public.merchant_reels ALTER COLUMN merchant_id DROP NOT NULL;

-- Add site_product_id column to link to main site products
ALTER TABLE public.merchant_reels ADD COLUMN site_product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;
