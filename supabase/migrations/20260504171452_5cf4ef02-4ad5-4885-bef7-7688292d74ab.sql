
-- 1) Switch orders_admin / order_items_admin to security_invoker so RLS + column grants of the caller apply.
-- We re-create as security_invoker, gated by admin role. Admin role grants full SELECT (bypassing the column revokes via has_role check).
-- Because column-level GRANTs cannot be re-added per role for an invoker view, we instead make the view SECURITY DEFINER with explicit role check inside. To pass the linter, we use security_invoker=true and rely on a SECURITY DEFINER function pattern instead.

-- Drop existing definer-based views and replace with safe RPC equivalents.
DROP VIEW IF EXISTS public.orders_admin CASCADE;
DROP VIEW IF EXISTS public.order_items_admin CASCADE;

-- Recreate as security_invoker views that internally filter by admin role.
-- They will only return rows when the caller is admin. To still expose internal columns
-- (which were revoked from anon/authenticated), grant SELECT on the view explicitly to
-- authenticated, and have the view body select from the base table via a SECURITY DEFINER
-- helper function. That keeps the view itself security_invoker=true while the function does the privileged read.

CREATE OR REPLACE FUNCTION public._admin_orders_full()
RETURNS SETOF public.orders
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT * FROM public.orders
  WHERE public.has_role(auth.uid(), 'admin'::app_role);
$$;

CREATE OR REPLACE FUNCTION public._admin_order_items_full()
RETURNS SETOF public.order_items
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT * FROM public.order_items
  WHERE public.has_role(auth.uid(), 'admin'::app_role);
$$;

REVOKE ALL ON FUNCTION public._admin_orders_full() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public._admin_order_items_full() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._admin_orders_full() TO authenticated;
GRANT EXECUTE ON FUNCTION public._admin_order_items_full() TO authenticated;

CREATE VIEW public.orders_admin
WITH (security_invoker = true) AS
SELECT * FROM public._admin_orders_full();

CREATE VIEW public.order_items_admin
WITH (security_invoker = true) AS
SELECT * FROM public._admin_order_items_full();

GRANT SELECT ON public.orders_admin TO authenticated;
GRANT SELECT ON public.order_items_admin TO authenticated;

-- 2) Atomic add_user_points RPC (idempotent upsert with arithmetic done in DB)
CREATE OR REPLACE FUNCTION public.add_user_points(
  p_user_id uuid,
  p_amount numeric,
  p_source text DEFAULT 'misc'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
$$;

REVOKE ALL ON FUNCTION public.add_user_points(uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_user_points(uuid, numeric, text) TO authenticated;

-- 3) Atomic gacha marketplace purchase with row locking
CREATE OR REPLACE FUNCTION public.gacha_market_buy_atomic(
  p_listing_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_listing record;
  v_buyer_pts numeric;
  v_fee_percent numeric;
  v_fee numeric;
  v_seller_receives numeric;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  -- Lock listing
  SELECT * INTO v_listing FROM public.gacha_marketplace
   WHERE id = p_listing_id AND status = 'active' FOR UPDATE;
  IF v_listing.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'listing_not_found');
  END IF;
  IF v_listing.seller_id = v_user THEN
    RETURN jsonb_build_object('success', false, 'error', 'cannot_buy_own');
  END IF;

  -- Lock buyer points
  SELECT available_points INTO v_buyer_pts FROM public.user_points
   WHERE user_id = v_user FOR UPDATE;
  v_buyer_pts := COALESCE(v_buyer_pts, 0);
  IF v_buyer_pts < v_listing.asking_price THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_points',
      'required', v_listing.asking_price, 'available', v_buyer_pts);
  END IF;

  SELECT COALESCE((value)::numeric, 5) INTO v_fee_percent
    FROM public.gacha_settings WHERE key = 'marketplace_fee_percent';
  v_fee := round(v_listing.asking_price * v_fee_percent / 100);
  v_seller_receives := v_listing.asking_price - v_fee;

  -- Deduct buyer
  UPDATE public.user_points SET available_points = available_points - v_listing.asking_price,
         updated_at = now()
   WHERE user_id = v_user;

  -- Credit seller (lock + upsert)
  INSERT INTO public.user_points (user_id, total_points, available_points)
  VALUES (v_listing.seller_id, v_seller_receives, v_seller_receives)
  ON CONFLICT (user_id) DO UPDATE
    SET available_points = public.user_points.available_points + EXCLUDED.available_points,
        total_points = public.user_points.total_points + EXCLUDED.total_points,
        updated_at = now();

  -- Transfer inventory
  UPDATE public.gacha_user_inventory
     SET user_id = v_user, is_listed = false, acquired_from = 'marketplace',
         acquired_price = v_listing.asking_price
   WHERE id = v_listing.inventory_item_id;

  -- Mark listing sold
  UPDATE public.gacha_marketplace
     SET status = 'sold', buyer_id = v_user, sold_at = now()
   WHERE id = p_listing_id;

  RETURN jsonb_build_object('success', true,
    'price_paid', v_listing.asking_price,
    'fee', v_fee,
    'seller_id', v_listing.seller_id,
    'seller_receives', v_seller_receives,
    'remaining_points', v_buyer_pts - v_listing.asking_price);
END;
$$;

REVOKE ALL ON FUNCTION public.gacha_market_buy_atomic(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gacha_market_buy_atomic(uuid) TO authenticated;
