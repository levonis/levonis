-- Add cost_price column to product_offers table for profit calculations
ALTER TABLE public.product_offers 
ADD COLUMN IF NOT EXISTS cost_price numeric DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN public.product_offers.cost_price IS 'Cost price for profit calculation (admin only)';