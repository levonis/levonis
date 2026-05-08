-- ===========================================================================
-- 1) add_user_points: lock to service_role only + internal guard
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.add_user_points(p_user_id uuid, p_amount numeric, p_source text DEFAULT 'misc'::text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Hard gate: only service_role (edge functions) may call this directly.
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role'
     AND auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'add_user_points: caller is not service_role';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
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

REVOKE ALL ON FUNCTION public.add_user_points(uuid, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_user_points(uuid, numeric, text) TO service_role;

-- ===========================================================================
-- 2) product_offers.cost_price: hide from non-admin readers via column grants
--    Pattern mirrors products_admin (security_invoker view + admin-checked SD function).
-- ===========================================================================

-- Drop existing table-level SELECT, then re-grant on every column EXCEPT cost_price.
REVOKE SELECT ON public.product_offers FROM anon, authenticated;

GRANT SELECT (
  id, title, title_ar, description, description_ar, image_url, images,
  price, currency, gift_tickets, status, stock_quantity, total_sold,
  created_at, updated_at, options, colors, points_reward, show_in_cart,
  title_en, title_ku, description_en, description_ku
) ON public.product_offers TO anon, authenticated;

-- Admin-only access to full row including cost_price
CREATE OR REPLACE FUNCTION public._admin_product_offers_full()
RETURNS SETOF public.product_offers
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT * FROM public.product_offers
  WHERE public.has_role(auth.uid(), 'admin'::app_role);
$function$;

REVOKE ALL ON FUNCTION public._admin_product_offers_full() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._admin_product_offers_full() TO authenticated;

DROP VIEW IF EXISTS public.product_offers_admin;
CREATE VIEW public.product_offers_admin
WITH (security_invoker = true)
AS
SELECT * FROM public._admin_product_offers_full();

GRANT SELECT ON public.product_offers_admin TO authenticated;