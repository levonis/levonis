-- Add is_featured column to merchant_products
ALTER TABLE public.merchant_products
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;

-- Create index for faster featured products queries
CREATE INDEX IF NOT EXISTS idx_merchant_products_is_featured ON public.merchant_products(is_featured);

-- Create function to enforce max 3 featured products per merchant
CREATE OR REPLACE FUNCTION public.check_featured_products_limit()
RETURNS TRIGGER AS $$
DECLARE
  featured_count INTEGER;
BEGIN
  -- If setting is_featured to true, check the limit
  IF NEW.is_featured = true THEN
    SELECT COUNT(*)
    INTO featured_count
    FROM public.merchant_products
    WHERE merchant_id = NEW.merchant_id
      AND is_featured = true
      AND id != NEW.id; -- exclude the current product being updated
    
    IF featured_count >= 3 THEN
      RAISE EXCEPTION 'لا يمكن تمييز أكثر من 3 منتجات. قم بإلغاء تمييز منتج آخر أولاً.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce featured products limit
DROP TRIGGER IF EXISTS enforce_featured_products_limit ON public.merchant_products;
CREATE TRIGGER enforce_featured_products_limit
BEFORE INSERT OR UPDATE OF is_featured ON public.merchant_products
FOR EACH ROW
EXECUTE FUNCTION public.check_featured_products_limit();