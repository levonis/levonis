ALTER TABLE public.merchant_applications
  ADD COLUMN IF NOT EXISTS store_background_type TEXT NOT NULL DEFAULT 'glass',
  ADD COLUMN IF NOT EXISTS store_background_value TEXT,
  ADD COLUMN IF NOT EXISTS store_background_blur INTEGER NOT NULL DEFAULT 20;

ALTER TABLE public.merchant_applications
  DROP CONSTRAINT IF EXISTS merchant_applications_store_background_type_check;

ALTER TABLE public.merchant_applications
  ADD CONSTRAINT merchant_applications_store_background_type_check
  CHECK (store_background_type IN ('glass','color','gradient','image'));

ALTER TABLE public.merchant_applications
  DROP CONSTRAINT IF EXISTS merchant_applications_store_background_blur_check;

ALTER TABLE public.merchant_applications
  ADD CONSTRAINT merchant_applications_store_background_blur_check
  CHECK (store_background_blur BETWEEN 0 AND 60);