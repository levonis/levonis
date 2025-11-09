-- Add availability tracking for product options
ALTER TABLE product_options 
ADD COLUMN IF NOT EXISTS available_for_direct_sale BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS available_for_pre_order BOOLEAN DEFAULT false;

-- Add availability tracking for product colors (stored in products.colors jsonb)
-- Colors will be stored as: {"name": "أحمر", "name_en": "Red", "hex_code": "#ff0000", "image_url": "...", "available_for_direct_sale": true, "available_for_pre_order": false}

COMMENT ON COLUMN product_options.available_for_direct_sale IS 'Whether this option is available for direct sale (in stock)';
COMMENT ON COLUMN product_options.available_for_pre_order IS 'Whether this option is available for pre-order';