-- Add translation columns to main_sections
ALTER TABLE public.main_sections ADD COLUMN IF NOT EXISTS name_en text;
ALTER TABLE public.main_sections ADD COLUMN IF NOT EXISTS name_ku text;

-- Add translation columns to categories
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS name_ku text;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS description_ku text;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS description_en text;

-- Add translation columns to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS name_en text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS name_ku text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS description_en text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS description_ku text;