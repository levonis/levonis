ALTER TABLE public.product_batches 
ADD COLUMN bundle_id UUID REFERENCES public.product_bundles(id) ON DELETE SET NULL;