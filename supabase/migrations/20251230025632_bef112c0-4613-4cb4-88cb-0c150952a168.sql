-- Add original_price (for discounted price feature) and last_renewed_at columns
ALTER TABLE public.user_listings 
ADD COLUMN IF NOT EXISTS original_price numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS last_renewed_at timestamp with time zone DEFAULT NULL;