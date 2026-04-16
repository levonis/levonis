
-- Add free delivery and actual cost columns to delivery_methods
ALTER TABLE public.delivery_methods
  ADD COLUMN IF NOT EXISTS free_delivery_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS free_delivery_min_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_cost integer NOT NULL DEFAULT 0;

-- Add personal delivery cost to products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS personal_delivery_cost integer NOT NULL DEFAULT 0;
