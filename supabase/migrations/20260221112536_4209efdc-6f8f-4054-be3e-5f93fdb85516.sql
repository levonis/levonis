
-- Add delivery_rules column to merchant_public_profiles for governorate exceptions and amount-based tiers
ALTER TABLE public.merchant_public_profiles 
ADD COLUMN IF NOT EXISTS delivery_rules JSONB DEFAULT '{"exceptions": [], "tiers": []}';

-- delivery_rules format:
-- {
--   "exceptions": [{ "governorate": "بغداد", "price": 7000 }, ...],
--   "tiers": [{ "min_order_amount": 50000, "delivery_price": 3000 }, { "min_order_amount": 100000, "delivery_price": 0 }]
-- }

COMMENT ON COLUMN public.merchant_public_profiles.delivery_rules IS 'JSON: governorate exceptions and amount-based delivery tiers';
