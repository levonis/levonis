-- Add stock fields for products without options/colors
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS direct_stock integer DEFAULT NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS pre_order_stock integer DEFAULT NULL;