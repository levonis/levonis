-- Add phone_number and governorate columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS phone_number text,
ADD COLUMN IF NOT EXISTS governorate text;

-- Add comment for governorate column
COMMENT ON COLUMN public.profiles.governorate IS 'Iraqi governorate/province of the user';