-- Add cost price column to products table for admin profit calculation
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS cost_price numeric DEFAULT NULL;

-- Add shipping_from column to custom_product_requests for shipping origin
ALTER TABLE public.custom_product_requests ADD COLUMN IF NOT EXISTS shipping_from text DEFAULT 'usa';

COMMENT ON COLUMN public.products.cost_price IS 'سعر التكلفة/الجملة للأدمن لحساب الربح';
COMMENT ON COLUMN public.custom_product_requests.shipping_from IS 'بلد الشحن: usa, uk, china';