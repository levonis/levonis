
-- 1) SUPA_security_definer_view: switch remaining views to invoker rights
ALTER VIEW public.delivery_methods_admin SET (security_invoker = true);
ALTER VIEW public.merchant_public_profiles_admin SET (security_invoker = true);

-- 2) merchant_public_profiles_debt_exposure: revoke sensitive columns from public roles
REVOKE SELECT (total_debt, debt_suspended, debt_suspended_at)
  ON public.merchant_public_profiles FROM anon, authenticated, PUBLIC;

-- 3) merchant_ad_bookings_text_uid_mismatch: replace fragile text policy with a verified join
DROP POLICY IF EXISTS "Merchant can read their ad bookings" ON public.merchant_ad_bookings;
CREATE POLICY "Merchant can read their ad bookings"
ON public.merchant_ad_bookings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.merchant_applications ma
    WHERE ma.user_id = auth.uid()
      AND ma.id::text = merchant_ad_bookings.merchant_id
  )
);

-- 4) merchant_giveaway_entries_public_userids: restrict SELECT to entrant, involved merchant, or admin
DROP POLICY IF EXISTS "Authenticated can view entries" ON public.merchant_giveaway_entries;
CREATE POLICY "Entrants merchants and admins can view entries"
ON public.merchant_giveaway_entries
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'assistant'::app_role)
  OR EXISTS (
    SELECT 1
    FROM public.merchant_giveaways g
    JOIN public.merchant_applications ma ON ma.id = g.winner_merchant_id
    WHERE g.id = merchant_giveaway_entries.giveaway_id
      AND ma.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.merchant_applications ma
    WHERE ma.id = merchant_giveaway_entries.merchant_id
      AND ma.user_id = auth.uid()
  )
);
