
-- Add accepted payment methods to merchant profiles
-- Default is full prepayment only
ALTER TABLE public.merchant_public_profiles 
ADD COLUMN IF NOT EXISTS accepted_payment_methods jsonb DEFAULT '["full_prepayment"]'::jsonb;

-- Comment for clarity
COMMENT ON COLUMN public.merchant_public_profiles.accepted_payment_methods IS 'Array of accepted payment methods: full_prepayment, half_payment, quarter_payment, cash_on_delivery';
