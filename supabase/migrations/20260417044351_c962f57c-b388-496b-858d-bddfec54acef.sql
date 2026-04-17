
-- 1. referral_coupons
CREATE TABLE public.referral_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL,
  code text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  total_uses integer NOT NULL DEFAULT 0,
  total_earnings_iqd numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_referral_coupons_owner ON public.referral_coupons(owner_user_id);
CREATE INDEX idx_referral_coupons_code ON public.referral_coupons(code);

ALTER TABLE public.referral_coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their coupons"
  ON public.referral_coupons FOR SELECT
  USING (auth.uid() = owner_user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners can update their coupons"
  ON public.referral_coupons FOR UPDATE
  USING (auth.uid() = owner_user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage coupons"
  ON public.referral_coupons FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners can insert their coupon"
  ON public.referral_coupons FOR INSERT
  WITH CHECK (auth.uid() = owner_user_id);

-- 2. referral_coupon_usages
CREATE TABLE public.referral_coupon_usages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.referral_coupons(id) ON DELETE CASCADE,
  order_id uuid,
  buyer_user_id uuid NOT NULL,
  delivery_discount_iqd numeric NOT NULL DEFAULT 0,
  owner_earnings_iqd numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_referral_usages_coupon ON public.referral_coupon_usages(coupon_id);
CREATE INDEX idx_referral_usages_order ON public.referral_coupon_usages(order_id);
CREATE INDEX idx_referral_usages_buyer ON public.referral_coupon_usages(buyer_user_id);

ALTER TABLE public.referral_coupon_usages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coupon owners can view their usages"
  ON public.referral_coupon_usages FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.referral_coupons rc WHERE rc.id = coupon_id AND rc.owner_user_id = auth.uid())
    OR auth.uid() = buyer_user_id
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins manage usages"
  ON public.referral_coupon_usages FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Buyers insert their usage"
  ON public.referral_coupon_usages FOR INSERT
  WITH CHECK (auth.uid() = buyer_user_id);

-- 3. referral_earnings_withdrawals
CREATE TABLE public.referral_earnings_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL,
  amount_iqd numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX idx_referral_withdrawals_owner ON public.referral_earnings_withdrawals(owner_user_id);

ALTER TABLE public.referral_earnings_withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view their withdrawals"
  ON public.referral_earnings_withdrawals FOR SELECT
  USING (auth.uid() = owner_user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners create their withdrawals"
  ON public.referral_earnings_withdrawals FOR INSERT
  WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Admins manage withdrawals"
  ON public.referral_earnings_withdrawals FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. New columns
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS referral_earnings_iqd numeric NOT NULL DEFAULT 0;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS referral_coupon_id uuid,
  ADD COLUMN IF NOT EXISTS referral_owner_earnings_iqd numeric NOT NULL DEFAULT 0;

-- 5. RPC: apply_referral_coupon
CREATE OR REPLACE FUNCTION public.apply_referral_coupon(p_code text, p_buyer_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coupon record;
  v_owner_username text;
BEGIN
  SELECT * INTO v_coupon
  FROM public.referral_coupons
  WHERE lower(code) = lower(p_code)
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'invalid_or_expired');
  END IF;

  IF v_coupon.owner_user_id = p_buyer_user_id THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'self_use_not_allowed');
  END IF;

  SELECT username INTO v_owner_username
  FROM public.profiles
  WHERE id = v_coupon.owner_user_id;

  RETURN jsonb_build_object(
    'valid', true,
    'coupon_id', v_coupon.id,
    'owner_user_id', v_coupon.owner_user_id,
    'owner_username', COALESCE(v_owner_username, 'levo_vip'),
    'free_delivery', true
  );
END;
$$;

-- 6. updated_at trigger for referral_coupons
CREATE TRIGGER update_referral_coupons_updated_at
  BEFORE UPDATE ON public.referral_coupons
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
