
-- 1) Revoke internal cost/margin columns on products from public roles
REVOKE SELECT (cost_price, commission_iqd, commission_sea_iqd, commission_air_iqd, commission_direct_iqd, other_costs_iqd, shipping_cost_iqd, price_usd, original_price_usd, referral_earnings_iqd)
  ON public.products FROM anon, authenticated;

-- 2) Revoke actual_cost on delivery_methods
REVOKE SELECT (actual_cost) ON public.delivery_methods FROM anon, authenticated;

-- 3) Restrict merchant debt fields
REVOKE SELECT (total_debt, debt_suspended, debt_suspended_at) ON public.merchant_public_profiles FROM anon, authenticated;

-- Re-grant debt fields to the merchant themself + admins via a SECURITY DEFINER view
DROP VIEW IF EXISTS public.merchant_debt_self;
CREATE VIEW public.merchant_debt_self
WITH (security_invoker = true) AS
SELECT mpp.id, mpp.total_debt, mpp.debt_suspended, mpp.debt_suspended_at
FROM public.merchant_public_profiles mpp
WHERE mpp.id IN (
  SELECT ma.id FROM public.merchant_applications ma WHERE ma.user_id = auth.uid()
) OR public.has_role(auth.uid(), 'admin'::app_role);

GRANT SELECT ON public.merchant_debt_self TO anon, authenticated;

-- 4) Restrict merchant_monthly_orders to merchant + admins
DROP POLICY IF EXISTS "Anyone can view merchant monthly orders" ON public.merchant_monthly_orders;
CREATE POLICY "Merchants and admins can view monthly orders"
ON public.merchant_monthly_orders FOR SELECT
USING (
  merchant_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
);
