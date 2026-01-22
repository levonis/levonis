-- Preferences for customer profile UI (quick actions)
CREATE TABLE IF NOT EXISTS public.user_profile_preferences (
  user_id UUID PRIMARY KEY,
  quick_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure row maps to a profile user id (not auth schema)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_profile_preferences_user_id_fkey'
  ) THEN
    ALTER TABLE public.user_profile_preferences
      ADD CONSTRAINT user_profile_preferences_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES public.profiles(id)
      ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE public.user_profile_preferences ENABLE ROW LEVEL SECURITY;

-- Users can manage their own preferences
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_profile_preferences'
      AND policyname = 'Users can view own profile preferences'
  ) THEN
    CREATE POLICY "Users can view own profile preferences"
    ON public.user_profile_preferences
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_profile_preferences'
      AND policyname = 'Users can insert own profile preferences'
  ) THEN
    CREATE POLICY "Users can insert own profile preferences"
    ON public.user_profile_preferences
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_profile_preferences'
      AND policyname = 'Users can update own profile preferences'
  ) THEN
    CREATE POLICY "Users can update own profile preferences"
    ON public.user_profile_preferences
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- updated_at trigger helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_user_profile_preferences_updated_at ON public.user_profile_preferences;
CREATE TRIGGER trg_user_profile_preferences_updated_at
BEFORE UPDATE ON public.user_profile_preferences
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();
