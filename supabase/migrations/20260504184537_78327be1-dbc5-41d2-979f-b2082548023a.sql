-- Admin-only view that exposes ALL product columns (including hidden cost/commission fields).
CREATE OR REPLACE VIEW public.products_admin
WITH (security_invoker = on) AS
SELECT * FROM public.products
WHERE public.has_role(auth.uid(), 'admin');

GRANT SELECT ON public.products_admin TO authenticated;