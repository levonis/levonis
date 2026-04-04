
-- Table to track card gifts
CREATE TABLE public.card_gifts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gifter_id UUID NOT NULL,
  recipient_id UUID NOT NULL,
  level_id UUID NOT NULL REFERENCES public.loyalty_levels(id),
  payment_method TEXT NOT NULL DEFAULT 'points',
  amount_paid NUMERIC NOT NULL DEFAULT 0,
  card_id UUID REFERENCES public.user_cards(id),
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.card_gifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own gifts"
  ON public.card_gifts FOR SELECT TO authenticated
  USING (auth.uid() = gifter_id OR auth.uid() = recipient_id);

CREATE POLICY "Users can insert gifts"
  ON public.card_gifts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = gifter_id);

-- Search users function for gifting
CREATE OR REPLACE FUNCTION public.search_users_for_gift(p_query TEXT)
RETURNS TABLE(id UUID, full_name TEXT, username TEXT, avatar_url TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.full_name, p.username, p.avatar_url
  FROM public.profiles p
  WHERE (p.full_name ILIKE '%' || p_query || '%' OR p.username ILIKE '%' || p_query || '%')
  LIMIT 10;
$$;

-- Gift card RPC
CREATE OR REPLACE FUNCTION public.gift_card_with_wallet(
  p_gifter_id UUID,
  p_recipient_id UUID,
  p_level_id UUID,
  p_message TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_level RECORD;
  v_wallet RECORD;
  v_new_card_id UUID;
  v_gift_id UUID;
  v_expires_at TIMESTAMPTZ;
BEGIN
  IF p_gifter_id = p_recipient_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'لا يمكنك إهداء بطاقة لنفسك');
  END IF;

  SELECT * INTO v_level FROM loyalty_levels WHERE id = p_level_id AND is_purchasable = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'البطاقة غير متاحة للشراء');
  END IF;

  IF v_level.wallet_price IS NULL OR v_level.wallet_price <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'هذه البطاقة لا يمكن شراؤها بالمحفظة');
  END IF;

  SELECT * INTO v_wallet FROM user_wallets WHERE user_id = p_gifter_id FOR UPDATE;
  IF NOT FOUND OR v_wallet.balance < v_level.wallet_price THEN
    RETURN jsonb_build_object('success', false, 'error', 'رصيد المحفظة غير كافٍ');
  END IF;

  -- Deduct from gifter wallet
  UPDATE user_wallets SET balance = balance - v_level.wallet_price, updated_at = now() WHERE user_id = p_gifter_id;

  -- Deactivate recipient's old card
  UPDATE user_cards SET is_active = false WHERE user_id = p_recipient_id AND is_active = true;

  -- Create card for recipient
  v_expires_at := now() + (v_level.duration_days || ' days')::INTERVAL;
  INSERT INTO user_cards (user_id, level_id, is_active, expires_at, payment_method, wallet_amount_paid)
  VALUES (p_recipient_id, p_level_id, true, v_expires_at, 'gift_wallet', v_level.wallet_price)
  RETURNING id INTO v_new_card_id;

  -- Record the gift
  INSERT INTO card_gifts (gifter_id, recipient_id, level_id, payment_method, amount_paid, card_id, message)
  VALUES (p_gifter_id, p_recipient_id, p_level_id, 'wallet', v_level.wallet_price, v_new_card_id, p_message)
  RETURNING id INTO v_gift_id;

  RETURN jsonb_build_object('success', true, 'card_id', v_new_card_id, 'gift_id', v_gift_id);
END;
$$;

-- Gift card with points
CREATE OR REPLACE FUNCTION public.gift_card_with_points(
  p_gifter_id UUID,
  p_recipient_id UUID,
  p_level_id UUID,
  p_message TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_level RECORD;
  v_points RECORD;
  v_new_card_id UUID;
  v_gift_id UUID;
  v_expires_at TIMESTAMPTZ;
BEGIN
  IF p_gifter_id = p_recipient_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'لا يمكنك إهداء بطاقة لنفسك');
  END IF;

  SELECT * INTO v_level FROM loyalty_levels WHERE id = p_level_id AND is_purchasable = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'البطاقة غير متاحة للشراء');
  END IF;

  IF v_level.purchase_price_points IS NULL OR v_level.purchase_price_points <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'هذه البطاقة لا يمكن شراؤها بالنقاط');
  END IF;

  SELECT * INTO v_points FROM user_points WHERE user_id = p_gifter_id FOR UPDATE;
  IF NOT FOUND OR v_points.available_points < v_level.purchase_price_points THEN
    RETURN jsonb_build_object('success', false, 'error', 'النقاط غير كافية');
  END IF;

  -- Deduct points
  UPDATE user_points SET available_points = available_points - v_level.purchase_price_points, updated_at = now() WHERE user_id = p_gifter_id;

  -- Deactivate recipient's old card
  UPDATE user_cards SET is_active = false WHERE user_id = p_recipient_id AND is_active = true;

  -- Create card for recipient
  v_expires_at := now() + (v_level.duration_days || ' days')::INTERVAL;
  INSERT INTO user_cards (user_id, level_id, is_active, expires_at, payment_method, wallet_amount_paid)
  VALUES (p_recipient_id, p_level_id, true, v_expires_at, 'gift_points', 0)
  RETURNING id INTO v_new_card_id;

  -- Record the gift
  INSERT INTO card_gifts (gifter_id, recipient_id, level_id, payment_method, amount_paid, card_id, message)
  VALUES (p_gifter_id, p_recipient_id, p_level_id, 'points', v_level.purchase_price_points, v_new_card_id, p_message)
  RETURNING id INTO v_gift_id;

  RETURN jsonb_build_object('success', true, 'card_id', v_new_card_id, 'gift_id', v_gift_id);
END;
$$;
