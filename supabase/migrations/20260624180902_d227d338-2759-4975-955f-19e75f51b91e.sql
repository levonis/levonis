
-- 1) products: revoke internal cost/commission columns from anon + authenticated
REVOKE SELECT (cost_price, other_costs_iqd, shipping_cost_iqd, commission_land_iqd, commission_sea_iqd, commission_air_iqd, commission_direct_iqd)
  ON public.products FROM anon, authenticated;

-- 2) product_options: revoke cost columns
REVOKE SELECT (cost_iqd, cost_usd) ON public.product_options FROM anon, authenticated;

-- 3) product_offers: revoke cost_price
REVOKE SELECT (cost_price) ON public.product_offers FROM anon, authenticated;

-- 4) delivery_methods: revoke actual_cost; create admin view
REVOKE SELECT (actual_cost) ON public.delivery_methods FROM anon, authenticated;

CREATE OR REPLACE VIEW public.delivery_methods_admin
WITH (security_invoker = false) AS
SELECT dm.*
FROM public.delivery_methods dm
WHERE public.has_role(auth.uid(), 'admin'::public.app_role);

GRANT SELECT ON public.delivery_methods_admin TO authenticated;

-- 5) merchant_public_profiles: revoke debt-related columns; create admin view
REVOKE SELECT (total_debt, debt_suspended, debt_suspended_at)
  ON public.merchant_public_profiles FROM anon, authenticated;

CREATE OR REPLACE VIEW public.merchant_public_profiles_admin
WITH (security_invoker = false) AS
SELECT mp.*
FROM public.merchant_public_profiles mp
WHERE public.has_role(auth.uid(), 'admin'::public.app_role);

GRANT SELECT ON public.merchant_public_profiles_admin TO authenticated;
