-- Add last_phone_change_at column for 2-week phone number change cooldown
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_phone_change_at timestamptz DEFAULT NULL;