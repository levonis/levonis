-- Auto-fill owner_earnings_iqd on insert when zero (computed from order items × product referral earnings)
CREATE OR REPLACE FUNCTION public.referral_usage_autofill_earnings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  computed_total numeric := 0;
BEGIN
  IF COALESCE(NEW.owner_earnings_iqd, 0) = 0 AND NEW.order_id IS NOT NULL THEN
    SELECT COALESCE(SUM(p.referral_earnings_iqd * oi.quantity), 0)
      INTO computed_total
      FROM public.order_items oi
      JOIN public.products p ON p.id = oi.product_id
     WHERE oi.order_id = NEW.order_id;

    IF computed_total > 0 THEN
      NEW.owner_earnings_iqd := computed_total;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_referral_usage_autofill_earnings ON public.referral_coupon_usages;
CREATE TRIGGER trg_referral_usage_autofill_earnings
BEFORE INSERT ON public.referral_coupon_usages
FOR EACH ROW
EXECUTE FUNCTION public.referral_usage_autofill_earnings();

-- Backfill again for any rows still at 0
UPDATE public.referral_coupon_usages u
   SET owner_earnings_iqd = computed.total
  FROM (
    SELECT oi.order_id,
           COALESCE(SUM(p.referral_earnings_iqd * oi.quantity), 0) AS total
      FROM public.order_items oi
      JOIN public.products p ON p.id = oi.product_id
     GROUP BY oi.order_id
  ) computed
 WHERE u.order_id = computed.order_id
   AND COALESCE(u.owner_earnings_iqd, 0) = 0
   AND computed.total > 0;