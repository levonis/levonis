ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS link_direct_commission_to_cod boolean NOT NULL DEFAULT false;