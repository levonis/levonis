ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS cod_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cod_fee_type text NOT NULL DEFAULT 'percentage',
  ADD COLUMN IF NOT EXISTS cod_fee_value numeric NOT NULL DEFAULT 0;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_cod_fee_type_check;

ALTER TABLE public.products
  ADD CONSTRAINT products_cod_fee_type_check
  CHECK (cod_fee_type IN ('percentage','fixed'));