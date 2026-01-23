-- Create a public-safe merchant profile table for marketplace browsing
CREATE TABLE IF NOT EXISTS public.merchant_public_profiles (
  id UUID PRIMARY KEY,
  display_name TEXT,
  store_image_url TEXT,
  bio TEXT,
  city TEXT,
  social_links JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.merchant_public_profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can read public merchant profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='merchant_public_profiles' AND policyname='Anyone can view merchant public profiles'
  ) THEN
    CREATE POLICY "Anyone can view merchant public profiles"
    ON public.merchant_public_profiles
    FOR SELECT
    USING (true);
  END IF;
END $$;

-- Keep updated_at fresh
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_merchant_public_profiles_updated_at ON public.merchant_public_profiles;
CREATE TRIGGER trg_merchant_public_profiles_updated_at
BEFORE UPDATE ON public.merchant_public_profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Sync table from merchant_applications without exposing sensitive fields
CREATE OR REPLACE FUNCTION public.sync_merchant_public_profile()
RETURNS TRIGGER AS $$
BEGIN
  -- Only keep rows for approved merchants
  IF NEW.status = 'approved' THEN
    INSERT INTO public.merchant_public_profiles (
      id,
      display_name,
      store_image_url,
      bio,
      city,
      social_links
    ) VALUES (
      NEW.id,
      NEW.display_name,
      NEW.store_image_url,
      NEW.bio,
      NEW.city,
      NEW.social_links::jsonb
    )
    ON CONFLICT (id) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      store_image_url = EXCLUDED.store_image_url,
      bio = EXCLUDED.bio,
      city = EXCLUDED.city,
      social_links = EXCLUDED.social_links,
      updated_at = now();
  ELSE
    DELETE FROM public.merchant_public_profiles WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_sync_merchant_public_profile ON public.merchant_applications;
CREATE TRIGGER trg_sync_merchant_public_profile
AFTER INSERT OR UPDATE OF status, display_name, store_image_url, bio, city, social_links
ON public.merchant_applications
FOR EACH ROW
EXECUTE FUNCTION public.sync_merchant_public_profile();

-- Backfill existing approved merchants
INSERT INTO public.merchant_public_profiles (id, display_name, store_image_url, bio, city, social_links)
SELECT id, display_name, store_image_url, bio, city, social_links::jsonb
FROM public.merchant_applications
WHERE status = 'approved'
ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  store_image_url = EXCLUDED.store_image_url,
  bio = EXCLUDED.bio,
  city = EXCLUDED.city,
  social_links = EXCLUDED.social_links,
  updated_at = now();