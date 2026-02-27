
-- Add separate price columns for different sale/shipping types
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sea_price numeric;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS air_price numeric;

-- Add comment for clarity
COMMENT ON COLUMN public.products.sea_price IS 'Pre-order sea shipping price in IQD';
COMMENT ON COLUMN public.products.air_price IS 'Pre-order air shipping price in IQD';
COMMENT ON COLUMN public.products.direct_sale_price IS 'Direct sale price in IQD';
