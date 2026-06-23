
-- Admin-only view exposing cost columns
CREATE OR REPLACE VIEW public.product_options_admin
WITH (security_invoker = true)
AS SELECT * FROM public.product_options;

REVOKE ALL ON public.product_options_admin FROM anon, authenticated, PUBLIC;
GRANT SELECT ON public.product_options_admin TO authenticated;
GRANT ALL ON public.product_options_admin TO service_role;

-- Hide cost columns from public/authenticated reads on the base table
REVOKE SELECT (cost_usd, cost_iqd) ON public.product_options FROM anon, authenticated, PUBLIC;
