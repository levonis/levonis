
-- 1) Add coupon columns to orders (for admin visibility and correct financials)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS coupon_id uuid REFERENCES public.coupons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS coupon_code text,
  ADD COLUMN IF NOT EXISTS coupon_discount_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coupon_free_shipping boolean NOT NULL DEFAULT false;

-- 2) Link coupon_usage to a specific order (for audit + de-duplication)
ALTER TABLE public.coupon_usage
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL;

-- Clean up existing duplicate usages before adding the unique index:
-- keep the earliest row per (coupon_id, user_id) that has no order_id.
DELETE FROM public.coupon_usage a
USING public.coupon_usage b
WHERE a.coupon_id = b.coupon_id
  AND a.user_id = b.user_id
  AND a.order_id IS NULL
  AND b.order_id IS NULL
  AND a.used_at > b.used_at;

-- Unique per (coupon_id, order_id) when order_id is present.
CREATE UNIQUE INDEX IF NOT EXISTS coupon_usage_coupon_order_unique
  ON public.coupon_usage (coupon_id, order_id)
  WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS coupon_usage_order_idx
  ON public.coupon_usage (order_id);

-- 3) Atomic RPC: record a coupon use tied to an order and bump current_uses.
CREATE OR REPLACE FUNCTION public.record_coupon_use(
  p_coupon_id uuid,
  p_user_id uuid,
  p_order_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted boolean := false;
BEGIN
  IF p_coupon_id IS NULL OR p_user_id IS NULL OR p_order_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.coupon_usage (coupon_id, user_id, order_id)
  VALUES (p_coupon_id, p_user_id, p_order_id)
  ON CONFLICT (coupon_id, order_id) DO NOTHING
  RETURNING true INTO v_inserted;

  IF v_inserted THEN
    UPDATE public.coupons
       SET current_uses = COALESCE(current_uses, 0) + 1,
           updated_at   = now()
     WHERE id = p_coupon_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_coupon_use(uuid, uuid, uuid) TO authenticated, service_role;

-- 4) Backfill: resync current_uses to match real usage count.
UPDATE public.coupons c
   SET current_uses = COALESCE(u.cnt, 0),
       updated_at = now()
  FROM (
    SELECT coupon_id, COUNT(*)::int AS cnt
      FROM public.coupon_usage
     GROUP BY coupon_id
  ) u
 WHERE u.coupon_id = c.id
   AND COALESCE(c.current_uses, 0) <> COALESCE(u.cnt, 0);
