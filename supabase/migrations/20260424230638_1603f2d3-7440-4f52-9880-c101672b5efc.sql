ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS name_en text;

ALTER TABLE public.product_options
  ADD COLUMN IF NOT EXISTS name_en text;

ALTER TABLE public.delivery_methods
  ADD COLUMN IF NOT EXISTS name_en text,
  ADD COLUMN IF NOT EXISTS description_en text;

COMMENT ON COLUMN public.categories.name_en IS 'Category name in English. Falls back to name_ar if empty.';
COMMENT ON COLUMN public.product_options.name_en IS 'Option (color/variant) name in English. Falls back to name_ar.';
COMMENT ON COLUMN public.delivery_methods.name_en IS 'Delivery method name in English.';
COMMENT ON COLUMN public.delivery_methods.description_en IS 'Delivery method description in English.';