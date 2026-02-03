-- Add points_reward column to product_offers table
ALTER TABLE public.product_offers ADD COLUMN IF NOT EXISTS points_reward integer DEFAULT 0;

-- Add a comment for documentation
COMMENT ON COLUMN public.product_offers.points_reward IS 'Points awarded to user upon purchase';