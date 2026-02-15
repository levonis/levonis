
ALTER TABLE public.merchant_public_profiles ADD COLUMN IF NOT EXISTS store_layout TEXT NOT NULL DEFAULT 'standard';

-- Sync existing store_layout values from merchant_applications
UPDATE public.merchant_public_profiles mp
SET store_layout = ma.store_layout
FROM public.merchant_applications ma
WHERE mp.id = ma.id AND ma.store_layout IS NOT NULL;
