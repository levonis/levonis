-- Add features column to products table
ALTER TABLE public.products 
ADD COLUMN features jsonb DEFAULT '[]'::jsonb;