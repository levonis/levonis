-- =========================================================================
-- 1) add_user_points: enforce caller identity + amount cap
-- =========================================================================
CREATE OR REPLACE FUNCTION public.add_user_points(p_user_id uuid, p_amount numeric, p_source text DEFAULT 'misc'::text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN false;
  END IF;

  -- Only admins (or service_role) may award points to other users or large amounts.
  IF auth.uid() IS NULL OR (p_user_id <> auth.uid() AND NOT public.has_role(auth.uid(), 'admin'::app_role)) THEN
    RETURN false;
  END IF;

  IF p_amount > 5000 AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN false;
  END IF;

  INSERT INTO public.user_points (user_id, total_points, available_points)
  VALUES (p_user_id, p_amount, p_amount)
  ON CONFLICT (user_id) DO UPDATE
    SET total_points = public.user_points.total_points + EXCLUDED.total_points,
        available_points = public.user_points.available_points + EXCLUDED.available_points,
        updated_at = now();

  RETURN true;
END;
$function$;

-- =========================================================================
-- 2) Storage: bundle-images — admin-only writes
-- =========================================================================
DROP POLICY IF EXISTS "Auth upload bundle images" ON storage.objects;
DROP POLICY IF EXISTS "Auth update bundle images" ON storage.objects;
DROP POLICY IF EXISTS "Auth delete bundle images" ON storage.objects;

CREATE POLICY "Admins manage bundle images insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'bundle-images' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage bundle images update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'bundle-images' AND public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (bucket_id = 'bundle-images' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage bundle images delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'bundle-images' AND public.has_role(auth.uid(), 'admin'::app_role));

-- =========================================================================
-- 3) Storage: game-rewards — admin-only writes
-- =========================================================================
DROP POLICY IF EXISTS "Authenticated users can upload game reward images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update game reward images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete game reward images" ON storage.objects;

CREATE POLICY "Admins manage game rewards insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'game-rewards' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage game rewards update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'game-rewards' AND public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (bucket_id = 'game-rewards' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage game rewards delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'game-rewards' AND public.has_role(auth.uid(), 'admin'::app_role));

-- =========================================================================
-- 4) Storage: merchant-reviews — enforce folder ownership on insert
-- =========================================================================
DROP POLICY IF EXISTS "Authenticated users can upload review media" ON storage.objects;

CREATE POLICY "Users upload review media to own folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'merchant-reviews'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

-- =========================================================================
-- 5) mystery_case_spins: drop redundant always-true policy (service_role bypasses RLS)
-- =========================================================================
DROP POLICY IF EXISTS "Service role inserts spins" ON public.mystery_case_spins;

-- =========================================================================
-- 6) web_vitals: replace always-true insert policy with bounded input check
-- =========================================================================
DROP POLICY IF EXISTS "Anyone can insert web vitals" ON public.web_vitals;

CREATE POLICY "Anyone can insert sane web vitals"
  ON public.web_vitals FOR INSERT TO anon, authenticated
  WITH CHECK (
    metric_name IN ('CLS','FCP','FID','INP','LCP','TTFB')
    AND (metric_value IS NULL OR (metric_value >= 0 AND metric_value < 1000000))
    AND (path IS NULL OR length(path) <= 512)
    AND (user_agent IS NULL OR length(user_agent) <= 1024)
    AND (metric_id IS NULL OR length(metric_id) <= 128)
    AND (user_id IS NULL OR user_id = auth.uid())
  );

-- =========================================================================
-- 7) internal_http_secrets: add admin-only policies (table had RLS but no policies)
-- =========================================================================
CREATE POLICY "Admins read internal http secrets"
  ON public.internal_http_secrets FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage internal http secrets"
  ON public.internal_http_secrets FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- =========================================================================
-- 8) products_admin: refactor to admin-checked SECURITY DEFINER function
--    so the view itself can run as security_invoker (linter friendly).
-- =========================================================================
CREATE OR REPLACE FUNCTION public._admin_products_full()
RETURNS SETOF public.products
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT * FROM public.products
  WHERE public.has_role(auth.uid(), 'admin'::app_role);
$function$;

REVOKE ALL ON FUNCTION public._admin_products_full() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._admin_products_full() TO authenticated;

DROP VIEW IF EXISTS public.products_admin;
CREATE VIEW public.products_admin
WITH (security_invoker = true)
AS
SELECT * FROM public._admin_products_full();

GRANT SELECT ON public.products_admin TO authenticated;

-- Flip orders_admin / order_items_admin to security_invoker (admin gate already lives in helper functions)
ALTER VIEW public.orders_admin SET (security_invoker = true);
ALTER VIEW public.order_items_admin SET (security_invoker = true);

-- =========================================================================
-- 9) community_customer_profiles.total_spent: revoke column-level SELECT
--    from regular users (admin/owner still see it via community_customer_profiles_public view).
-- =========================================================================
REVOKE SELECT (total_spent) ON public.community_customer_profiles FROM authenticated, anon;
