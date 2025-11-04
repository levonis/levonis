-- Add selected_color column to cart_items table
ALTER TABLE public.cart_items ADD COLUMN IF NOT EXISTS selected_color TEXT;