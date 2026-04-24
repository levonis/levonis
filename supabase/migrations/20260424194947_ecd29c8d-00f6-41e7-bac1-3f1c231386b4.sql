-- 1) Status enum
DO $$ BEGIN
  CREATE TYPE public.price_protection_status AS ENUM ('pending', 'awaiting_admin', 'processed', 'rejected');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2) Claims table
CREATE TABLE IF NOT EXISTS public.price_protection_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  order_id UUID NOT NULL,
  order_item_id UUID NOT NULL,
  product_id UUID NOT NULL,
  product_name_ar TEXT,
  product_image TEXT,
  order_number TEXT,
  purchase_date TIMESTAMPTZ NOT NULL,
  old_price NUMERIC NOT NULL,
  new_price NUMERIC NOT NULL,
  price_difference NUMERIC NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  total_refund NUMERIC NOT NULL,
  status public.price_protection_status NOT NULL DEFAULT 'pending',
  user_requested_at TIMESTAMPTZ,
  admin_id UUID,
  admin_notes TEXT,
  rejection_reason TEXT,
  refunded_amount NUMERIC,
  processed_at TIMESTAMPTZ,
  conversation_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_item_id)
);

CREATE INDEX IF NOT EXISTS idx_ppc_user ON public.price_protection_claims(user_id, status);
CREATE INDEX IF NOT EXISTS idx_ppc_status ON public.price_protection_claims(status, created_at DESC);

-- 3) RLS
ALTER TABLE public.price_protection_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_view_own_claims" ON public.price_protection_claims;
CREATE POLICY "users_view_own_claims" ON public.price_protection_claims
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins_manage_claims" ON public.price_protection_claims;
CREATE POLICY "admins_manage_claims" ON public.price_protection_claims
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "users_update_own_request" ON public.price_protection_claims;
CREATE POLICY "users_update_own_request" ON public.price_protection_claims
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4) Updated_at trigger
DROP TRIGGER IF EXISTS trg_ppc_updated_at ON public.price_protection_claims;
CREATE TRIGGER trg_ppc_updated_at
BEFORE UPDATE ON public.price_protection_claims
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) Detection function: scans eligible orders when product price drops
CREATE OR REPLACE FUNCTION public.detect_price_protection_for_product(p_product_id UUID, p_new_price NUMERIC)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count INTEGER := 0;
  rec RECORD;
  reference_date TIMESTAMPTZ;
BEGIN
  FOR rec IN
    SELECT 
      oi.id AS oi_id,
      oi.order_id,
      oi.product_id,
      oi.product_name_ar,
      oi.unit_price,
      oi.quantity,
      o.user_id,
      o.order_number,
      o.confirmed_at,
      o.delivered_at,
      o.user_confirmed_at,
      o.status,
      p.image_url
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    LEFT JOIN public.products p ON p.id = oi.product_id
    WHERE oi.product_id = p_product_id
      AND oi.unit_price > p_new_price
      AND o.status IN ('confirmed','processing','shipped','arrived_warehouse','arrived_iraq','on_the_way','purchased','delivered')
      AND COALESCE(o.user_confirmed_delivery, false) = true OR o.confirmed_at IS NOT NULL
  LOOP
    -- Determine reference date (delivered/confirmed)
    reference_date := COALESCE(rec.user_confirmed_at, rec.delivered_at, rec.confirmed_at);
    IF reference_date IS NULL THEN CONTINUE; END IF;
    -- Within 7 days
    IF reference_date < (now() - INTERVAL '7 days') THEN CONTINUE; END IF;

    INSERT INTO public.price_protection_claims (
      user_id, order_id, order_item_id, product_id,
      product_name_ar, product_image, order_number,
      purchase_date, old_price, new_price, price_difference,
      quantity, total_refund, status
    ) VALUES (
      rec.user_id, rec.order_id, rec.oi_id, rec.product_id,
      rec.product_name_ar, rec.image_url, rec.order_number,
      reference_date, rec.unit_price, p_new_price, (rec.unit_price - p_new_price),
      rec.quantity, (rec.unit_price - p_new_price) * rec.quantity, 'pending'
    )
    ON CONFLICT (order_item_id) DO NOTHING;

    IF FOUND THEN inserted_count := inserted_count + 1; END IF;
  END LOOP;
  RETURN inserted_count;
END;
$$;

-- 6) Trigger on products price update
CREATE OR REPLACE FUNCTION public.trg_product_price_drop()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.price IS DISTINCT FROM OLD.price AND NEW.price < OLD.price THEN
    PERFORM public.detect_price_protection_for_product(NEW.id, NEW.price);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_price_drop ON public.products;
CREATE TRIGGER trg_products_price_drop
AFTER UPDATE OF price ON public.products
FOR EACH ROW EXECUTE FUNCTION public.trg_product_price_drop();

-- 7) Approve claim RPC: credits user wallet and marks processed
CREATE OR REPLACE FUNCTION public.approve_price_protection_claim(p_claim_id UUID, p_refund_amount NUMERIC, p_admin_notes TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claim RECORD;
  v_admin UUID := auth.uid();
BEGIN
  IF NOT public.has_role(v_admin, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT * INTO v_claim FROM public.price_protection_claims WHERE id = p_claim_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;
  IF v_claim.status = 'processed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_processed');
  END IF;

  -- Credit wallet (create if missing)
  INSERT INTO public.user_wallets (user_id, balance, currency)
  VALUES (v_claim.user_id, p_refund_amount, 'IQD')
  ON CONFLICT (user_id) DO UPDATE SET balance = public.user_wallets.balance + p_refund_amount, updated_at = now();

  UPDATE public.price_protection_claims
  SET status = 'processed',
      refunded_amount = p_refund_amount,
      admin_id = v_admin,
      admin_notes = COALESCE(p_admin_notes, admin_notes),
      processed_at = now()
  WHERE id = p_claim_id;

  RETURN jsonb_build_object('success', true, 'refunded', p_refund_amount);
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_price_protection_claim(p_claim_id UUID, p_reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_admin UUID := auth.uid();
BEGIN
  IF NOT public.has_role(v_admin, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;
  UPDATE public.price_protection_claims
  SET status = 'rejected', rejection_reason = p_reason, admin_id = v_admin, processed_at = now()
  WHERE id = p_claim_id;
  RETURN jsonb_build_object('success', true);
END;
$$;