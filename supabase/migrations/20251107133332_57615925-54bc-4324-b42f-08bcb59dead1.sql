-- Add flexible pre-order shipping options field
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS pre_order_shipping_options JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN products.pre_order_shipping_options IS 'Array of shipping options for pre-orders. Each option has: name, name_ar, price_adjustment (can be positive, negative, or 0)';

-- Example structure:
-- [
--   {"name": "Free Shipping", "name_ar": "شحن مجاني", "price_adjustment": 0},
--   {"name": "Fast Shipping", "name_ar": "شحن سريع", "price_adjustment": 5000},
--   {"name": "Express", "name_ar": "شحن فوري", "price_adjustment": 10000}
-- ]