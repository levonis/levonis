-- Recreate products_admin with security_invoker OFF so it runs with the view owner's privileges,
-- bypassing the column-level revokes on the base table. Access is still gated by has_role check.
DROP VIEW IF EXISTS public.products_admin;

CREATE VIEW public.products_admin
WITH (security_invoker = off) AS
SELECT * FROM public.products
WHERE public.has_role(auth.uid(), 'admin');

GRANT SELECT ON public.products_admin TO authenticated;