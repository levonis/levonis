-- Auto-remove cart_items whose linked product becomes hidden
-- (products.is_pricing_updated flipped from true -> false or set to false).
-- Preserves locked / gift / RF cart rows.

CREATE OR REPLACE FUNCTION public.remove_hidden_products_from_carts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_pricing_updated IS DISTINCT FROM true THEN
    DELETE FROM public.cart_items ci
    WHERE ci.product_id = NEW.id
      AND COALESCE(ci.is_locked, false) = false
      AND COALESCE(ci.is_gift, false) = false
      AND ci.rf_offer_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_remove_hidden_products_from_carts ON public.products;
CREATE TRIGGER trg_remove_hidden_products_from_carts
AFTER UPDATE OF is_pricing_updated ON public.products
FOR EACH ROW
WHEN (NEW.is_pricing_updated IS DISTINCT FROM true)
EXECUTE FUNCTION public.remove_hidden_products_from_carts();

-- One-time cleanup: purge existing cart rows tied to currently-hidden products.
DELETE FROM public.cart_items ci
USING public.products p
WHERE ci.product_id = p.id
  AND p.is_pricing_updated = false
  AND COALESCE(ci.is_locked, false) = false
  AND COALESCE(ci.is_gift, false) = false
  AND ci.rf_offer_id IS NULL;