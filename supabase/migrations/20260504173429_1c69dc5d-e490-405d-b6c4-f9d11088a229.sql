-- Re-apply column-level SELECT revokes that were not retained for sensitive financial fields.

-- products: hide internal cost / commission / margin fields from anon and authenticated
REVOKE SELECT (
  cost_price,
  commission_iqd,
  commission_sea_iqd,
  commission_air_iqd,
  commission_direct_iqd,
  other_costs_iqd,
  shipping_cost_iqd,
  price_usd,
  original_price_usd,
  referral_earnings_iqd
) ON public.products FROM anon, authenticated;

-- delivery_methods: hide platform's internal logistics cost
REVOKE SELECT (actual_cost) ON public.delivery_methods FROM anon, authenticated;

-- merchant_public_profiles: hide debt/suspension fields (use merchant_debt_self view for owner+admin)
REVOKE SELECT (total_debt, debt_suspended, debt_suspended_at)
  ON public.merchant_public_profiles FROM anon, authenticated;
