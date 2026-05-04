-- Re-grant non-sensitive price/reward columns that the client UI needs.
-- These were over-revoked in a prior security tightening which broke product fetches.
GRANT SELECT (price_usd, original_price_usd, referral_earnings_iqd)
  ON public.products TO anon, authenticated;