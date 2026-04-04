
-- Fix: Add missing columns to wallet_transactions
ALTER TABLE public.wallet_transactions
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS balance_after NUMERIC;

-- Add card discount tracking to orders
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS card_discount_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS card_discount_level_name TEXT;
