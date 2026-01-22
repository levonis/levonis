-- Fix security warning: Set search_path for function
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
$$ LANGUAGE plpgsql SET search_path = public;