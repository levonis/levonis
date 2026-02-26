
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS commission_iqd numeric DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS other_costs_iqd numeric DEFAULT 0;
