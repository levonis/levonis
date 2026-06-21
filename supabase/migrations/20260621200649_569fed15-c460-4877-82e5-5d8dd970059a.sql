
-- 1) Revoke sensitive cost/commission columns on products
REVOKE SELECT (cost_price, commission_iqd, commission_sea_iqd, commission_air_iqd, commission_direct_iqd, commission_land_iqd, other_costs_iqd, shipping_cost_iqd) ON public.products FROM anon, authenticated;

-- 2) Revoke cost_price on order_items from authenticated
REVOKE SELECT (cost_price) ON public.order_items FROM authenticated, anon;

-- 3) Revoke cost_price on product_offers from anon/authenticated
REVOKE SELECT (cost_price) ON public.product_offers FROM anon, authenticated;

-- 4) Revoke debt fields on merchant_public_profiles from anon/authenticated
REVOKE SELECT (total_debt, debt_suspended, debt_suspended_at) ON public.merchant_public_profiles FROM anon, authenticated;

-- 5) Server-side enforcement of is_admin_reply on merchant_rating_comments
CREATE OR REPLACE FUNCTION public.enforce_is_admin_reply()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.is_admin_reply, false) = true AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    NEW.is_admin_reply := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_is_admin_reply ON public.merchant_rating_comments;
CREATE TRIGGER trg_enforce_is_admin_reply
BEFORE INSERT OR UPDATE ON public.merchant_rating_comments
FOR EACH ROW EXECUTE FUNCTION public.enforce_is_admin_reply();

-- 6) Remove donations_log from realtime publication to prevent cross-user broadcast leakage
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='donations_log') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.donations_log';
  END IF;
END $$;
