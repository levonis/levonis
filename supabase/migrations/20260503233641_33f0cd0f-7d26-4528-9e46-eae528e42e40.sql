-- 1) Strengthen cart-delete protection: block any delete of an RF cart item by non-admin
CREATE OR REPLACE FUNCTION public.protect_random_filament_cart_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.random_filament_orders WHERE cart_item_id = OLD.id)
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'RANDOM_FILAMENT_LOCKED'
      USING HINT = 'لا يمكن إلغاء طلب الفلمنت العشوائي. أي محاولة قد تؤدي للحظر.';
  END IF;
  RETURN OLD;
END;
$$;

-- 2) Block non-admin order cancellation when order has any RF entry
CREATE OR REPLACE FUNCTION public.protect_random_filament_order_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled'
     AND NOT public.has_role(auth.uid(), 'admin')
     AND EXISTS (SELECT 1 FROM public.random_filament_orders WHERE order_id = NEW.id) THEN
    RAISE EXCEPTION 'RANDOM_FILAMENT_ORDER_LOCKED'
      USING HINT = 'لا يمكن إلغاء طلب يحتوي على فلمنت عشوائي بعد الدفع.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_rf_order_cancel ON public.orders;
CREATE TRIGGER trg_protect_rf_order_cancel
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.protect_random_filament_order_cancel();