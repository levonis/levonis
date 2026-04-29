
ALTER TABLE public.merchant_applications
  ADD COLUMN IF NOT EXISTS store_slug text;

ALTER TABLE public.merchant_public_profiles
  ADD COLUMN IF NOT EXISTS store_slug text;

CREATE OR REPLACE FUNCTION public.normalize_store_slug(input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  s text;
BEGIN
  IF input IS NULL THEN RETURN NULL; END IF;
  s := lower(trim(input));
  s := regexp_replace(s, '[^a-z0-9]+', '-', 'g');
  s := regexp_replace(s, '(^-+|-+$)', '', 'g');
  IF length(s) = 0 THEN RETURN NULL; END IF;
  RETURN s;
END;
$$;

-- Backfill merchant_applications
DO $$
DECLARE
  rec RECORD;
  base text;
  candidate text;
  n int;
BEGIN
  FOR rec IN
    SELECT ma.id, ma.display_name, p.username
    FROM public.merchant_applications ma
    LEFT JOIN public.profiles p ON p.id = ma.user_id
    WHERE ma.store_slug IS NULL
  LOOP
    base := COALESCE(public.normalize_store_slug(rec.username), public.normalize_store_slug(rec.display_name), 'store');
    candidate := base;
    n := 1;
    WHILE EXISTS (SELECT 1 FROM public.merchant_applications WHERE store_slug = candidate) LOOP
      n := n + 1;
      candidate := base || '-' || n::text;
    END LOOP;
    UPDATE public.merchant_applications SET store_slug = candidate WHERE id = rec.id;
  END LOOP;
END$$;

-- Mirror to merchant_public_profiles
UPDATE public.merchant_public_profiles mpp
SET store_slug = ma.store_slug
FROM public.merchant_applications ma
WHERE ma.id = mpp.id AND mpp.store_slug IS DISTINCT FROM ma.store_slug;

CREATE UNIQUE INDEX IF NOT EXISTS uq_merchant_applications_store_slug
  ON public.merchant_applications(store_slug)
  WHERE store_slug IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_merchant_public_profiles_store_slug
  ON public.merchant_public_profiles(store_slug)
  WHERE store_slug IS NOT NULL;

CREATE OR REPLACE FUNCTION public.ensure_merchant_store_slug()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base text;
  candidate text;
  n int;
  uname text;
BEGIN
  IF NEW.store_slug IS NOT NULL AND length(trim(NEW.store_slug)) > 0 THEN
    NEW.store_slug := public.normalize_store_slug(NEW.store_slug);
  ELSE
    SELECT username INTO uname FROM public.profiles WHERE id = NEW.user_id;
    base := COALESCE(public.normalize_store_slug(uname), public.normalize_store_slug(NEW.display_name), 'store');
    candidate := base;
    n := 1;
    WHILE EXISTS (SELECT 1 FROM public.merchant_applications WHERE store_slug = candidate AND id <> NEW.id) LOOP
      n := n + 1;
      candidate := base || '-' || n::text;
    END LOOP;
    NEW.store_slug := candidate;
  END IF;
  -- Mirror to public profile
  UPDATE public.merchant_public_profiles SET store_slug = NEW.store_slug WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_merchant_store_slug ON public.merchant_applications;
CREATE TRIGGER trg_merchant_store_slug
  BEFORE INSERT OR UPDATE OF store_slug, display_name ON public.merchant_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_merchant_store_slug();
