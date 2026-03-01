
-- Add variant-specific columns to stock_notifications
ALTER TABLE public.stock_notifications 
  ADD COLUMN IF NOT EXISTS selected_color TEXT,
  ADD COLUMN IF NOT EXISTS selected_option TEXT;

-- Drop existing unique constraint if any and add new one with variant columns
ALTER TABLE public.stock_notifications 
  DROP CONSTRAINT IF EXISTS stock_notifications_user_id_product_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS stock_notifications_user_variant_unique 
  ON public.stock_notifications (user_id, product_id, COALESCE(selected_color, ''), COALESCE(selected_option, ''));
