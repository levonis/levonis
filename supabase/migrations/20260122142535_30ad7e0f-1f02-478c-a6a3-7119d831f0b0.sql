-- Add profile-completion fields for Levo Community customer onboarding
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS birth_date date,
ADD COLUMN IF NOT EXISTS gender text,
ADD COLUMN IF NOT EXISTS bio text;

-- Optional: keep gender values consistent (immutable check is OK)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_gender_check'
  ) THEN
    ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_gender_check
    CHECK (gender IS NULL OR gender IN ('male','female'));
  END IF;
END $$;

-- Helpful indexes for lookups/filtering later (safe, non-breaking)
CREATE INDEX IF NOT EXISTS idx_profiles_gender ON public.profiles (gender);
CREATE INDEX IF NOT EXISTS idx_profiles_birth_date ON public.profiles (birth_date);
