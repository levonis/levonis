
-- 1) Revoke sensitive product columns from public clients
REVOKE SELECT (cost_price, commission_iqd, commission_air_iqd, commission_sea_iqd, commission_direct_iqd, other_costs_iqd, shipping_cost_iqd, original_price_usd, price_usd, referral_earnings_iqd) ON public.products FROM anon, authenticated;

-- 2) Revoke product_offers.cost_price from public
REVOKE SELECT (cost_price) ON public.product_offers FROM anon, authenticated;

-- 3) Revoke delivery_methods.actual_cost
REVOKE SELECT (actual_cost) ON public.delivery_methods FROM anon, authenticated;

-- 4) Revoke merchant debt/financial fields from public
REVOKE SELECT (total_debt, debt_suspended, debt_suspended_at) ON public.merchant_public_profiles FROM anon, authenticated;

-- 5) Fix products_admin SECURITY DEFINER view -> use invoker semantics
ALTER VIEW public.products_admin SET (security_invoker = true);

-- 6) Atomic wallet credit RPC (admin/service callable). Uses row lock + single UPDATE.
CREATE OR REPLACE FUNCTION public.credit_user_wallet(p_user_id uuid, p_amount numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be positive';
  END IF;

  INSERT INTO public.user_wallets (user_id, balance)
  VALUES (p_user_id, p_amount)
  ON CONFLICT (user_id) DO UPDATE
    SET balance = public.user_wallets.balance + EXCLUDED.balance,
        updated_at = now()
  RETURNING balance INTO v_balance;

  RETURN v_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.credit_user_wallet(uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_user_wallet(uuid, numeric) TO service_role;
