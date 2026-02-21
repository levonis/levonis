
-- Add debt tracking fields to merchant_public_profiles
ALTER TABLE public.merchant_public_profiles 
  ADD COLUMN IF NOT EXISTS total_debt NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS debt_suspended BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS debt_suspended_at TIMESTAMPTZ;
