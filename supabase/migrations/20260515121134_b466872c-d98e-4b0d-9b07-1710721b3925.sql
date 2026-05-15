-- Only log order-based donations when an order becomes 'delivered'.
CREATE OR REPLACE FUNCTION public.log_order_donations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_name text;
BEGIN
  -- Only act when the order is delivered now and was not delivered before.
  IF NEW.status IS DISTINCT FROM 'delivered' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'delivered' THEN
    RETURN NEW;
  END IF;

  IF (COALESCE(NEW.auto_donation_amount, 0) > 0) OR (COALESCE(NEW.extra_donation_amount, 0) > 0) THEN
    SELECT COALESCE(full_name, username) INTO v_name
      FROM public.profiles WHERE id = NEW.user_id;
  END IF;

  IF COALESCE(NEW.auto_donation_amount, 0) > 0 THEN
    INSERT INTO public.donations_log (user_id, display_name, amount, source, order_id)
    SELECT NEW.user_id, v_name, NEW.auto_donation_amount, 'order_auto', NEW.id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.donations_log d
      WHERE d.order_id = NEW.id AND d.source = 'order_auto'
    );
  END IF;

  IF COALESCE(NEW.extra_donation_amount, 0) > 0 THEN
    INSERT INTO public.donations_log (user_id, display_name, amount, source, order_id)
    SELECT NEW.user_id, v_name, NEW.extra_donation_amount, 'order_extra', NEW.id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.donations_log d
      WHERE d.order_id = NEW.id AND d.source = 'order_extra'
    );
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_log_order_donations ON public.orders;
CREATE TRIGGER trg_log_order_donations
AFTER INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.log_order_donations();