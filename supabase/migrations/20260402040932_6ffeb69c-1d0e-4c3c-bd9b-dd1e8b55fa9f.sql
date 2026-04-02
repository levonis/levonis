ALTER TABLE public.order_items 
ADD COLUMN bundle_id UUID REFERENCES public.product_bundles(id) ON DELETE SET NULL;