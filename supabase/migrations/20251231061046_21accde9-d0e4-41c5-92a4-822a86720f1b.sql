-- Add cost_price column to order_items for per-product cost tracking
ALTER TABLE public.order_items 
ADD COLUMN cost_price numeric DEFAULT 0;

-- Add comment explaining the field
COMMENT ON COLUMN public.order_items.cost_price IS 'Cost price per unit for admin profit calculations';