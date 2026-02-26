ALTER TABLE public.products ADD COLUMN IF NOT EXISTS commission_sea_iqd numeric DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS commission_air_iqd numeric DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS commission_direct_iqd numeric DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS original_price_usd numeric DEFAULT 0;