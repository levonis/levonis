
-- 1. Revoke cost_price column SELECT on product_offers from anon/authenticated
REVOKE SELECT (cost_price) ON public.product_offers FROM anon, authenticated;

-- 2. Restrict total_spent on community_customer_profiles to owner/admin only
REVOKE SELECT (total_spent) ON public.community_customer_profiles FROM anon, authenticated;

-- Update the public view to mask total_spent for non-owners (so admin pages keep working via base table)
CREATE OR REPLACE VIEW public.community_customer_profiles_public
WITH (security_invoker = true)
AS
SELECT
  id,
  user_id,
  CASE WHEN user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) THEN display_name ELSE NULL::text END AS display_name,
  CASE WHEN user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) THEN bio ELSE NULL::text END AS bio,
  CASE WHEN user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) THEN avatar_url ELSE NULL::text END AS avatar_url,
  frame_url,
  total_requests_made,
  total_requests_received,
  CASE WHEN user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) THEN total_spent ELSE NULL::numeric(12,2) END AS total_spent,
  reputation_score,
  is_verified,
  is_suspended,
  created_at,
  updated_at
FROM public.community_customer_profiles;

GRANT SELECT ON public.community_customer_profiles_public TO anon, authenticated;

-- 3. Atomic gacha prize stock decrement to prevent over-award race condition
CREATE OR REPLACE FUNCTION public.decrement_gacha_prize_stock(p_prize_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated uuid;
BEGIN
  UPDATE public.gacha_machine_prizes
     SET stock = stock - 1
   WHERE id = p_prize_id
     AND stock IS NOT NULL
     AND stock > 0
   RETURNING id INTO v_updated;
  RETURN v_updated IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.decrement_gacha_prize_stock(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_gacha_prize_stock(uuid) TO service_role;
