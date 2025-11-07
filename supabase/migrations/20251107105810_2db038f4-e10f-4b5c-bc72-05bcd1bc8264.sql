-- Add color_image_url column to cart_items table
ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS color_image_url TEXT;