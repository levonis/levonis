-- Add option_image_url column to cart_items table
ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS option_image_url TEXT;

-- Add comment to explain the column
COMMENT ON COLUMN cart_items.option_image_url IS 'Custom image URL for the selected product option';