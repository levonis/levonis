ALTER TABLE public.merchant_public_profiles
  ADD COLUMN IF NOT EXISTS store_background_type TEXT NOT NULL DEFAULT 'glass',
  ADD COLUMN IF NOT EXISTS store_background_value TEXT,
  ADD COLUMN IF NOT EXISTS store_background_blur INTEGER NOT NULL DEFAULT 20;

-- Backfill from merchant_applications
UPDATE public.merchant_public_profiles p
SET store_background_type = m.store_background_type,
    store_background_value = m.store_background_value,
    store_background_blur = m.store_background_blur
FROM public.merchant_applications m
WHERE p.id = m.id;

-- Trigger to sync background changes from merchant_applications -> merchant_public_profiles
CREATE OR REPLACE FUNCTION public.sync_merchant_background_to_public()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.merchant_public_profiles
    SET store_background_type = NEW.store_background_type,
        store_background_value = NEW.store_background_value,
        store_background_blur = NEW.store_background_blur,
        updated_at = now()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_merchant_background ON public.merchant_applications;
CREATE TRIGGER trg_sync_merchant_background
AFTER UPDATE OF store_background_type, store_background_value, store_background_blur
ON public.merchant_applications
FOR EACH ROW
EXECUTE FUNCTION public.sync_merchant_background_to_public();