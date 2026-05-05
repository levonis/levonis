
-- ============================================================
-- Part 1: Remove printer warranty benefits (discount + free shipping)
-- ============================================================
DROP FUNCTION IF EXISTS public.consume_warranty_benefit(uuid, uuid, text, numeric, text);
DROP FUNCTION IF EXISTS public.consume_warranty_benefit CASCADE;
DROP FUNCTION IF EXISTS public.get_active_warranty_benefits_for_user(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_active_warranty_benefits_for_user CASCADE;
DROP TABLE IF EXISTS public.printer_warranty_usage CASCADE;
DROP TABLE IF EXISTS public.printer_warranty_benefits CASCADE;

-- ============================================================
-- Part 2: Loyalty Card Activation Codes
-- ============================================================

CREATE TABLE public.loyalty_card_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.membership_cards(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  batch_id uuid NOT NULL,
  batch_label text,
  duration_days integer NOT NULL CHECK (duration_days > 0),
  code_expires_at timestamptz NOT NULL,
  requires_active_warranty boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','redeemed','expired','revoked')),
  redeemed_by_user_id uuid,
  redeemed_user_printer_id uuid,
  redeemed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_loyalty_card_codes_batch ON public.loyalty_card_codes(batch_id);
CREATE INDEX idx_loyalty_card_codes_card ON public.loyalty_card_codes(card_id);
CREATE INDEX idx_loyalty_card_codes_status ON public.loyalty_card_codes(status);
CREATE INDEX idx_loyalty_card_codes_redeemed_user ON public.loyalty_card_codes(redeemed_by_user_id);

ALTER TABLE public.loyalty_card_codes ENABLE ROW LEVEL SECURITY;

-- Admins can manage everything
CREATE POLICY "Admins manage loyalty card codes" ON public.loyalty_card_codes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Redeemer can see their own redeemed codes (history)
CREATE POLICY "Users view their redeemed codes" ON public.loyalty_card_codes
  FOR SELECT TO authenticated
  USING (redeemed_by_user_id = auth.uid());

CREATE TRIGGER update_loyalty_card_codes_updated_at
  BEFORE UPDATE ON public.loyalty_card_codes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Random code generator (server-side, uppercase alphanumeric, 12 chars)
CREATE OR REPLACE FUNCTION public.generate_loyalty_code(p_length int DEFAULT 12)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
BEGIN
  FOR i IN 1..p_length LOOP
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Admin RPC: create a batch of codes
CREATE OR REPLACE FUNCTION public.create_loyalty_code_batch(
  p_card_id uuid,
  p_quantity int,
  p_duration_days int,
  p_code_expires_at timestamptz,
  p_batch_label text DEFAULT NULL,
  p_requires_active_warranty boolean DEFAULT true
)
RETURNS TABLE (id uuid, code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch_id uuid := gen_random_uuid();
  v_admin uuid := auth.uid();
  v_code text;
  i int;
BEGIN
  IF NOT public.has_role(v_admin, 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_quantity <= 0 OR p_quantity > 1000 THEN
    RAISE EXCEPTION 'invalid_quantity';
  END IF;
  IF p_duration_days <= 0 THEN
    RAISE EXCEPTION 'invalid_duration';
  END IF;
  IF p_code_expires_at <= now() THEN
    RAISE EXCEPTION 'invalid_expiry';
  END IF;

  FOR i IN 1..p_quantity LOOP
    LOOP
      v_code := public.generate_loyalty_code(12);
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.loyalty_card_codes WHERE code = v_code);
    END LOOP;
    INSERT INTO public.loyalty_card_codes(
      card_id, code, batch_id, batch_label, duration_days,
      code_expires_at, requires_active_warranty, created_by
    )
    VALUES (
      p_card_id, v_code, v_batch_id, p_batch_label, p_duration_days,
      p_code_expires_at, COALESCE(p_requires_active_warranty, true), v_admin
    )
    RETURNING loyalty_card_codes.id, loyalty_card_codes.code INTO id, code;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- User RPC: redeem a code
CREATE OR REPLACE FUNCTION public.redeem_loyalty_card_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_code public.loyalty_card_codes%ROWTYPE;
  v_printer_id uuid;
  v_user_card_id uuid;
  v_expires_at timestamptz;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  SELECT * INTO v_code
  FROM public.loyalty_card_codes
  WHERE code = upper(trim(p_code))
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'code_not_found';
  END IF;

  IF v_code.status <> 'active' THEN
    RAISE EXCEPTION 'code_already_used';
  END IF;

  IF v_code.code_expires_at <= now() THEN
    UPDATE public.loyalty_card_codes SET status='expired' WHERE id = v_code.id;
    RAISE EXCEPTION 'code_expired';
  END IF;

  -- Eligibility: at least one active printer warranty owned by this user
  IF v_code.requires_active_warranty THEN
    SELECT id INTO v_printer_id
    FROM public.store_printers
    WHERE buyer_user_id = v_user
      AND COALESCE(status, 'active') = 'active'
      AND expiry_date IS NOT NULL
      AND expiry_date > now()
    ORDER BY expiry_date DESC
    LIMIT 1;

    IF v_printer_id IS NULL THEN
      RAISE EXCEPTION 'no_active_warranty';
    END IF;
  END IF;

  -- Block if user already has an active card
  IF EXISTS (
    SELECT 1 FROM public.user_cards
    WHERE user_id = v_user
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
  ) THEN
    RAISE EXCEPTION 'already_has_active_card';
  END IF;

  v_expires_at := now() + (v_code.duration_days || ' days')::interval;

  INSERT INTO public.user_cards(
    user_id, card_id, purchased_at, expires_at,
    points_spent, is_active, payment_method, wallet_amount_paid
  )
  VALUES (
    v_user, v_code.card_id, now(), v_expires_at,
    0, true, 'code', 0
  )
  RETURNING id INTO v_user_card_id;

  UPDATE public.loyalty_card_codes
  SET status='redeemed',
      redeemed_by_user_id = v_user,
      redeemed_user_printer_id = v_printer_id,
      redeemed_at = now()
  WHERE id = v_code.id;

  RETURN jsonb_build_object(
    'user_card_id', v_user_card_id,
    'card_id', v_code.card_id,
    'expires_at', v_expires_at
  );
END;
$$;

-- Lazy expiry sweeper (callable by admin pages)
CREATE OR REPLACE FUNCTION public.expire_loyalty_card_codes()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  UPDATE public.loyalty_card_codes
  SET status='expired'
  WHERE status='active' AND code_expires_at <= now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_loyalty_code_batch(uuid, int, int, timestamptz, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_loyalty_card_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_loyalty_card_codes() TO authenticated;
