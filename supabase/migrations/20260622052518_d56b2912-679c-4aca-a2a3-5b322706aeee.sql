-- Revoke internal cost from delivery_methods for public roles
REVOKE SELECT (actual_cost) ON public.delivery_methods FROM anon, authenticated;

-- Revoke merchant debt fields from public roles on merchant_public_profiles
REVOKE SELECT (total_debt, debt_suspended, debt_suspended_at) ON public.merchant_public_profiles FROM anon, authenticated;