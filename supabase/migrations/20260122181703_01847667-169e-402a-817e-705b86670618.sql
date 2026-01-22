-- Add username cooldown + phone verification fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_username_change_at TIMESTAMPTZ NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone_verification_status TEXT NOT NULL DEFAULT 'unverified';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT false;

-- Enforce 14-day cooldown on username changes and stamp last change time
CREATE OR REPLACE FUNCTION public.enforce_username_change_cooldown()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.username IS DISTINCT FROM OLD.username THEN
    IF OLD.last_username_change_at IS NOT NULL
       AND now() < (OLD.last_username_change_at + interval '14 days') THEN
      RAISE EXCEPTION 'USERNAME_CHANGE_COOLDOWN'
        USING ERRCODE = 'P0001',
              DETAIL = 'You can change username only once every 14 days.';
    END IF;

    NEW.last_username_change_at = now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_profiles_username_cooldown ON public.profiles;
CREATE TRIGGER trg_profiles_username_cooldown
BEFORE UPDATE OF username ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_username_change_cooldown();
