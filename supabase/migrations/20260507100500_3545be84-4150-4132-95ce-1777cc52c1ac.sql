-- Fix: products_admin & financial admin views fail with "permission denied for table products"
-- because security_invoker=true requires the caller to have base-table SELECT, which was
-- fully revoked from authenticated as part of cost-field hardening.
-- Switch admin-only views to security_definer; the WHERE has_role(...) clause is the gate.

ALTER VIEW public.products_admin SET (security_invoker = false);
GRANT SELECT ON public.products_admin TO authenticated;

-- Same fix for orders/order_items admin views if they have the same issue.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname='public' AND viewname='orders_admin') THEN
    EXECUTE 'ALTER VIEW public.orders_admin SET (security_invoker = false)';
    EXECUTE 'GRANT SELECT ON public.orders_admin TO authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname='public' AND viewname='order_items_admin') THEN
    EXECUTE 'ALTER VIEW public.order_items_admin SET (security_invoker = false)';
    EXECUTE 'GRANT SELECT ON public.order_items_admin TO authenticated';
  END IF;
END $$;