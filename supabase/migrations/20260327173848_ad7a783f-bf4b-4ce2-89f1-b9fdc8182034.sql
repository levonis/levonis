
-- Policies already dropped/created in previous partial runs, clean up and recreate

-- 1. merchant_ad_bookings - already fixed in previous run

-- 2. user_points - already fixed in previous run

-- Security definer function for public level badge lookups (level is text)
CREATE OR REPLACE FUNCTION public.get_user_level(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT level FROM public.user_points WHERE user_id = p_user_id),
    '0'
  );
$$;

-- 3. community_customer_profiles - already fixed in previous run
