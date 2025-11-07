-- Add new fields to support both availability types
ALTER TABLE products 
ADD COLUMN has_in_stock BOOLEAN DEFAULT true,
ADD COLUMN has_pre_order BOOLEAN DEFAULT false;

-- Set initial values based on current availability_type
UPDATE products 
SET has_in_stock = (availability_type = 'in_stock'),
    has_pre_order = (availability_type = 'pre_order');

-- Add comment for clarity
COMMENT ON COLUMN products.has_in_stock IS 'Indicates if product is available in stock';
COMMENT ON COLUMN products.has_pre_order IS 'Indicates if product is available for pre-order';