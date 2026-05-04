-- Admin-only views that expose all columns. Owned by postgres, queried as authenticated.
-- We gate access via has_role() inside an RLS-style policy on the underlying tables won't
-- work for views, so we use a security_barrier view + a SELECT WHERE has_role check.

CREATE OR REPLACE VIEW public.orders_admin
WITH (security_invoker = false, security_barrier = true) AS
SELECT * FROM public.orders
WHERE public.has_role(auth.uid(), 'admin');

CREATE OR REPLACE VIEW public.order_items_admin
WITH (security_invoker = false, security_barrier = true) AS
SELECT oi.* FROM public.order_items oi
WHERE public.has_role(auth.uid(), 'admin');

GRANT SELECT ON public.orders_admin TO authenticated;
GRANT SELECT ON public.order_items_admin TO authenticated;