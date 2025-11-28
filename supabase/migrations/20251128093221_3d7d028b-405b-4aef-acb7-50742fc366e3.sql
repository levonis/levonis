-- Add neighborhood column to user_addresses table
ALTER TABLE public.user_addresses 
ADD COLUMN IF NOT EXISTS neighborhood text;