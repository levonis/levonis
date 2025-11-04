-- Make product_id nullable in cart_items to support custom requests
ALTER TABLE public.cart_items 
ALTER COLUMN product_id DROP NOT NULL;

-- Add a constraint to ensure either product_id or custom_request_id is present
ALTER TABLE public.cart_items
ADD CONSTRAINT check_product_or_custom_request 
CHECK (
  (product_id IS NOT NULL AND custom_request_id IS NULL) OR
  (product_id IS NULL AND custom_request_id IS NOT NULL)
);