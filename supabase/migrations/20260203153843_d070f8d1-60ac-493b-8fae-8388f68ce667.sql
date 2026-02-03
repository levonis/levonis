-- Add ticket_reward field to products table (like points_reward)
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS ticket_reward integer DEFAULT 0;

-- Add comment for clarity
COMMENT ON COLUMN public.products.ticket_reward IS 'Number of free tickets awarded when purchasing this product';

-- Add free_tickets_monthly to loyalty_levels for card holder benefits
ALTER TABLE public.loyalty_levels 
ADD COLUMN IF NOT EXISTS free_tickets_monthly integer DEFAULT 0;

COMMENT ON COLUMN public.loyalty_levels.free_tickets_monthly IS 'Free tickets given monthly to card holders of this level';