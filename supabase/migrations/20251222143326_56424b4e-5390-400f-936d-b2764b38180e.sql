-- Add prize_products array column to store multiple products
ALTER TABLE public.competitions 
ADD COLUMN IF NOT EXISTS prize_products jsonb DEFAULT '[]'::jsonb;

-- Add comment
COMMENT ON COLUMN public.competitions.prize_products IS 'Array of product IDs with quantities: [{product_id, quantity}]';