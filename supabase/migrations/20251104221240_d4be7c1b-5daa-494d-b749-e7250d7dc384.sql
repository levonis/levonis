-- Add colors column to products table
ALTER TABLE public.products 
ADD COLUMN colors JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.products.colors IS 'Array of color objects with name_ar, name, and hex_code';