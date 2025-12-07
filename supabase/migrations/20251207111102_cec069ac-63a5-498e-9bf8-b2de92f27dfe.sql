-- Add fields for admin paid amount and customer paid amount
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS admin_paid_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS customer_paid_amount numeric DEFAULT 0;