ALTER TABLE public.delivery_methods 
ADD COLUMN base_price_category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL DEFAULT NULL,
ADD COLUMN base_price_units_per_delivery INTEGER NOT NULL DEFAULT 1;