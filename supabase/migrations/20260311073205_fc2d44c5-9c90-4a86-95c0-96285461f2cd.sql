
ALTER TABLE public.product_bundles 
  ADD COLUMN IF NOT EXISTS sale_type text NOT NULL DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS images text[] DEFAULT '{}';
