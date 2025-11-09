-- Add image_url column to product_options table
ALTER TABLE product_options ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add comment to explain the column
COMMENT ON COLUMN product_options.image_url IS 'Custom image URL for this specific product option';