ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS auto_donation_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_donation_amount numeric NOT NULL DEFAULT 0;