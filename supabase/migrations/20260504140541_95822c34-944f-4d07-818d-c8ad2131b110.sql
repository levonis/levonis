-- Auto-reveal random filament selections when order becomes delivered (or user confirms delivery)
CREATE OR REPLACE FUNCTION public.auto_reveal_rf_on_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.status = 'delivered' AND COALESCE(OLD.status, '') <> 'delivered')
     OR (NEW.user_confirmed_delivery = true AND COALESCE(OLD.user_confirmed_delivery, false) = false)
  THEN
    UPDATE public.random_filament_orders rfo
    SET revealed_at = COALESCE(rfo.revealed_at, now())
    WHERE rfo.order_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_reveal_rf_on_delivery ON public.orders;
CREATE TRIGGER trg_auto_reveal_rf_on_delivery
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.auto_reveal_rf_on_delivery();