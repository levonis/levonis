ALTER TABLE public.mystery_case_rewards
  ADD COLUMN selected_color TEXT DEFAULT NULL,
  ADD COLUMN product_option_id UUID DEFAULT NULL REFERENCES public.product_options(id) ON DELETE SET NULL;