
-- Add new columns to loyalty_levels
ALTER TABLE public.loyalty_levels
  ADD COLUMN IF NOT EXISTS wallet_price numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_vip_plus boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS wholesale_discount_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS free_daily_games integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS investment_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS priority_packaging boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS priority_support boolean DEFAULT false;

-- Add wallet payment tracking to user_cards
ALTER TABLE public.user_cards
  ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'points',
  ADD COLUMN IF NOT EXISTS wallet_amount_paid numeric DEFAULT 0;

-- Update the VIP (Level 4) to be VIP Plus with all features
UPDATE public.loyalty_levels
SET
  name_ar = 'Levo VIP Plus',
  name_en = 'Levo VIP Plus',
  is_vip_plus = true,
  wholesale_discount_enabled = true,
  free_daily_games = 1,
  investment_enabled = true,
  priority_packaging = true,
  priority_support = true,
  vip_support = true,
  priority_shipping = true,
  free_shipping = true,
  special_name_style = jsonb_build_object(
    'enabled', true,
    'color', '#FFD700',
    'glow', true,
    'badge_icon', '/frames/levo-vip-badge.png'
  ),
  profile_effects = jsonb_build_object(
    'enabled', true,
    'border_color', '#FFD700',
    'background_glow', true,
    'avatar_frame', '/frames/levo-vip.svg'
  )
WHERE level_key = 'platinum';

-- Create secure function to purchase card with wallet
CREATE OR REPLACE FUNCTION public.purchase_card_with_wallet(
  p_user_id uuid,
  p_level_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_level RECORD;
  v_wallet RECORD;
  v_existing_card RECORD;
  v_card_id uuid;
  v_expires_at timestamptz;
BEGIN
  -- Get level info
  SELECT * INTO v_level FROM loyalty_levels WHERE id = p_level_id AND is_purchasable = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'البطاقة غير متاحة للشراء');
  END IF;

  -- Check wallet price is set
  IF v_level.wallet_price IS NULL OR v_level.wallet_price <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'سعر المحفظة غير محدد لهذه البطاقة');
  END IF;

  -- Get wallet with lock
  SELECT * INTO v_wallet FROM user_wallets WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND OR v_wallet.balance < v_level.wallet_price THEN
    RETURN jsonb_build_object('success', false, 'error', 'رصيد المحفظة غير كافٍ');
  END IF;

  -- Deactivate any existing active card
  UPDATE user_cards SET is_active = false, updated_at = now()
  WHERE user_id = p_user_id AND is_active = true;

  -- Calculate expiry
  v_expires_at := now() + (COALESCE(v_level.duration_days, 30) || ' days')::interval;

  -- Create new card
  INSERT INTO user_cards (user_id, level_id, purchased_at, expires_at, points_spent, is_active, payment_method, wallet_amount_paid)
  VALUES (p_user_id, p_level_id, now(), v_expires_at, 0, true, 'wallet', v_level.wallet_price)
  RETURNING id INTO v_card_id;

  -- Deduct wallet
  UPDATE user_wallets SET balance = balance - v_level.wallet_price, updated_at = now()
  WHERE user_id = p_user_id;

  -- Log wallet transaction
  INSERT INTO wallet_transactions (user_id, amount, type, description, balance_after)
  VALUES (
    p_user_id,
    -v_level.wallet_price,
    'purchase',
    'شراء بطاقة ' || v_level.name_ar,
    v_wallet.balance - v_level.wallet_price
  );

  RETURN jsonb_build_object(
    'success', true,
    'card_id', v_card_id,
    'expires_at', v_expires_at,
    'amount_paid', v_level.wallet_price
  );
END;
$$;

-- Also create/update the points purchase function
CREATE OR REPLACE FUNCTION public.purchase_card_with_points(
  p_user_id uuid,
  p_level_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_level RECORD;
  v_points RECORD;
  v_existing_card RECORD;
  v_card_id uuid;
  v_expires_at timestamptz;
BEGIN
  -- Get level info
  SELECT * INTO v_level FROM loyalty_levels WHERE id = p_level_id AND is_purchasable = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'البطاقة غير متاحة للشراء');
  END IF;

  IF v_level.purchase_price_points IS NULL OR v_level.purchase_price_points <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'سعر النقاط غير محدد');
  END IF;

  -- Get points with lock
  SELECT * INTO v_points FROM user_points WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND OR v_points.available_points < v_level.purchase_price_points THEN
    RETURN jsonb_build_object('success', false, 'error', 'النقاط غير كافية');
  END IF;

  -- Deactivate existing cards
  UPDATE user_cards SET is_active = false, updated_at = now()
  WHERE user_id = p_user_id AND is_active = true;

  v_expires_at := now() + (COALESCE(v_level.duration_days, 30) || ' days')::interval;

  -- Create card
  INSERT INTO user_cards (user_id, level_id, purchased_at, expires_at, points_spent, is_active, payment_method, wallet_amount_paid)
  VALUES (p_user_id, p_level_id, now(), v_expires_at, v_level.purchase_price_points, true, 'points', 0)
  RETURNING id INTO v_card_id;

  -- Deduct points
  UPDATE user_points SET available_points = available_points - v_level.purchase_price_points, updated_at = now()
  WHERE user_id = p_user_id;

  -- Log points transaction
  INSERT INTO points_transactions (user_id, points, type, source, description)
  VALUES (p_user_id, -v_level.purchase_price_points, 'spent', 'card_purchase', 'شراء بطاقة ' || v_level.name_ar);

  RETURN jsonb_build_object(
    'success', true,
    'card_id', v_card_id,
    'expires_at', v_expires_at,
    'points_spent', v_level.purchase_price_points
  );
END;
$$;
