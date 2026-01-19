-- Add product-specific points and card discount fields to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS points_reward integer DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS card_discount_level_id uuid REFERENCES public.loyalty_levels(id);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS card_discount_percentage numeric(5,2) DEFAULT 0;

-- Add comments for clarity
COMMENT ON COLUMN public.products.points_reward IS 'Points the customer earns when purchasing this product';
COMMENT ON COLUMN public.products.card_discount_level_id IS 'Minimum loyalty card level required to get the discount';
COMMENT ON COLUMN public.products.card_discount_percentage IS 'Discount percentage for card holders';