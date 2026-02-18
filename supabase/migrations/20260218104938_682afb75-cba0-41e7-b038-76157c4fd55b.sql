
-- Add new columns to merchant_products for stock, colors, options, preorder, payments
ALTER TABLE public.merchant_products
  ADD COLUMN IF NOT EXISTS stock_quantity integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS colors jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS options jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_preorder boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS preorder_end_date timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS preorder_queue_total integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS preorder_queue_current integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS allow_partial_payment boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_wallet_payment boolean DEFAULT true;

-- Add merchant-level store pause setting to merchant_applications
ALTER TABLE public.merchant_applications
  ADD COLUMN IF NOT EXISTS store_paused boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS store_pause_end_date timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS store_pause_message text DEFAULT NULL;
