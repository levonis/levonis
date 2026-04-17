
CREATE OR REPLACE FUNCTION public.sync_referral_usage_on_order_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'delivered' AND (OLD.status IS DISTINCT FROM 'delivered') THEN
    UPDATE public.referral_coupon_usages
       SET status = 'confirmed'
     WHERE order_id = NEW.id
       AND status = 'pending';
  ELSIF NEW.status = 'cancelled' AND (OLD.status IS DISTINCT FROM 'cancelled') THEN
    UPDATE public.referral_coupon_usages
       SET status = 'cancelled'
     WHERE order_id = NEW.id
       AND status IN ('pending', 'confirmed');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_referral_usage_on_order_status_trigger ON public.orders;
CREATE TRIGGER sync_referral_usage_on_order_status_trigger
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.sync_referral_usage_on_order_status();

-- Backfill existing delivered/cancelled orders
UPDATE public.referral_coupon_usages u
   SET status = 'confirmed'
  FROM public.orders o
 WHERE u.order_id = o.id
   AND o.status = 'delivered'
   AND u.status = 'pending';

UPDATE public.referral_coupon_usages u
   SET status = 'cancelled'
  FROM public.orders o
 WHERE u.order_id = o.id
   AND o.status = 'cancelled'
   AND u.status IN ('pending', 'confirmed');
