
ALTER TABLE public.user_purchased_products
ADD COLUMN IF NOT EXISTS offer_id UUID,
ADD COLUMN IF NOT EXISTS purchase_id UUID,
ADD COLUMN IF NOT EXISTS product_title TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
