
-- Add QR activation columns to store_printers
ALTER TABLE public.store_printers 
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS warranty_months integer DEFAULT 6,
  ADD COLUMN IF NOT EXISTS activation_date timestamptz,
  ADD COLUMN IF NOT EXISTS expiry_date timestamptz,
  ADD COLUMN IF NOT EXISTS qr_code_data text;

-- Update existing rows to 'active' status if they already have a buyer
UPDATE public.store_printers SET status = 'active' WHERE buyer_user_id IS NOT NULL;
