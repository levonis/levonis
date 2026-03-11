
ALTER TABLE public.cart_items 
ADD COLUMN IF NOT EXISTS bundle_id uuid REFERENCES public.product_bundles(id) ON DELETE SET NULL;
