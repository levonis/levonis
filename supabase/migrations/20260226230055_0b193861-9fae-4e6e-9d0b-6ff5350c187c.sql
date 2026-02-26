
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price_usd numeric DEFAULT NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS shipping_type text DEFAULT NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS weight_kg numeric DEFAULT NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS length_cm numeric DEFAULT NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS width_cm numeric DEFAULT NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS height_cm numeric DEFAULT NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS shipping_cost_iqd numeric DEFAULT NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_pricing_updated boolean DEFAULT false;
