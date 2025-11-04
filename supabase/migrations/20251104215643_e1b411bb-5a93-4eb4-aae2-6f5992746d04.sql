-- Add product_option_id column to cart_items
ALTER TABLE public.cart_items 
ADD COLUMN product_option_id UUID REFERENCES public.product_options(id) ON DELETE SET NULL;