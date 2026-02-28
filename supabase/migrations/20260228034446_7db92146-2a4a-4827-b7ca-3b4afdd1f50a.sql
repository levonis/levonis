
-- Add reorder tracking and additional comments to reviews
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS reorder_count integer DEFAULT 1;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS additional_comments jsonb DEFAULT '[]'::jsonb;

-- Create unique constraint to prevent duplicate reviews per user per product
CREATE UNIQUE INDEX IF NOT EXISTS reviews_user_product_unique ON public.reviews (user_id, product_id);
