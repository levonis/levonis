-- Add stripe_session_id column to wallet_transactions table
ALTER TABLE public.wallet_transactions 
ADD COLUMN IF NOT EXISTS stripe_session_id TEXT UNIQUE;