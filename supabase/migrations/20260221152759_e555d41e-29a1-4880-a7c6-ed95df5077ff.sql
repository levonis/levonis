ALTER TABLE public.merchant_products
  ADD COLUMN IF NOT EXISTS sale_type text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS max_queue_slots int DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS current_queue_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS preorder_deposit_percent int DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS preorder_available_date date DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS preorder_note text DEFAULT NULL;

COMMENT ON COLUMN public.merchant_products.sale_type IS 'normal | preorder | waitlist';