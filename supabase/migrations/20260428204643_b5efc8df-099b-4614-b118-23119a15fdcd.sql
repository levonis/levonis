
-- 0) Drop functions that may have different signatures
DROP FUNCTION IF EXISTS public.get_user_card_frame(uuid);
DROP FUNCTION IF EXISTS public.check_card_discount(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.use_card_discount(uuid, uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.purchase_card_with_points(uuid, uuid);
DROP FUNCTION IF EXISTS public.purchase_card_with_wallet(uuid, uuid);
DROP FUNCTION IF EXISTS public.gift_card_with_points(uuid, uuid, uuid, text);
DROP FUNCTION IF EXISTS public.gift_card_with_wallet(uuid, uuid, uuid, text);
DROP FUNCTION IF EXISTS public.admin_gift_loyalty_card(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.get_card_percentage_discount_used(uuid, uuid);
DROP FUNCTION IF EXISTS public.get_card_free_shipping_used(uuid, uuid);

-- 1) Create membership_cards
CREATE TABLE public.membership_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_key text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  name_en text,
  name_ku text,
  description_ar text,
  description_en text,
  description_ku text,
  color text DEFAULT '#3B82F6',
  card_color text,
  icon text,
  frame_url text,
  frame_animation text,
  price_points numeric NOT NULL DEFAULT 0,
  wallet_price numeric,
  duration_days integer NOT NULL DEFAULT 30,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  is_vip_plus boolean NOT NULL DEFAULT false,
  discount_percentage numeric NOT NULL DEFAULT 0,
  discount_percentage_max_amount numeric,
  discount_applicable_category_ids uuid[] DEFAULT '{}'::uuid[],
  card_discounts_enabled boolean NOT NULL DEFAULT true,
  free_shipping boolean NOT NULL DEFAULT false,
  free_shipping_min_order numeric DEFAULT 0,
  free_shipping_methods jsonb DEFAULT '[]'::jsonb,
  free_shipping_max_uses integer,
  free_shipping_applicable_category_ids uuid[] DEFAULT '{}'::uuid[],
  monthly_free_shipping integer DEFAULT 0,
  bonus_points_percentage numeric DEFAULT 0,
  free_tickets_monthly integer DEFAULT 0,
  free_daily_games integer DEFAULT 0,
  vip_support boolean DEFAULT false,
  priority_support boolean DEFAULT false,
  priority_shipping boolean DEFAULT false,
  priority_packaging boolean DEFAULT false,
  early_access boolean DEFAULT false,
  exclusive_products boolean DEFAULT false,
  wholesale_discount_enabled boolean DEFAULT false,
  investment_enabled boolean DEFAULT false,
  special_name_style jsonb DEFAULT '{}'::jsonb,
  profile_effects jsonb DEFAULT '{}'::jsonb,
  benefits jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.membership_cards (
  id, card_key, name_ar, name_en, color, card_color, icon, frame_url, frame_animation,
  price_points, wallet_price, duration_days, is_active, display_order, is_vip_plus,
  discount_percentage, discount_percentage_max_amount, discount_applicable_category_ids, card_discounts_enabled,
  free_shipping, free_shipping_min_order, free_shipping_methods, free_shipping_max_uses, free_shipping_applicable_category_ids,
  monthly_free_shipping, bonus_points_percentage, free_tickets_monthly, free_daily_games,
  vip_support, priority_support, priority_shipping, priority_packaging, early_access, exclusive_products,
  wholesale_discount_enabled, investment_enabled, special_name_style, profile_effects, benefits
)
SELECT
  id, level_key, name_ar, name_en, color, color, icon, frame_url, frame_animation,
  COALESCE(purchase_price_points, 0), wallet_price, COALESCE(duration_days, 30), true, COALESCE(display_order, 0), COALESCE(is_vip_plus, false),
  COALESCE(discount_percentage, 0), discount_percentage_max_amount, COALESCE(discount_applicable_category_ids, '{}'::uuid[]), COALESCE(card_discounts_enabled, true),
  COALESCE(free_shipping, false), COALESCE(free_shipping_min_order, 0), COALESCE(free_shipping_methods, '[]'::jsonb), free_shipping_max_uses, COALESCE(free_shipping_applicable_category_ids, '{}'::uuid[]),
  COALESCE(monthly_free_shipping, 0), COALESCE(bonus_points_percentage, 0), COALESCE(free_tickets_monthly, 0), COALESCE(free_daily_games, 0),
  COALESCE(vip_support, false), COALESCE(priority_support, false), COALESCE(priority_shipping, false), COALESCE(priority_packaging, false),
  COALESCE(early_access, false), COALESCE(exclusive_products, false),
  COALESCE(wholesale_discount_enabled, false), COALESCE(investment_enabled, false),
  COALESCE(special_name_style, '{}'::jsonb), COALESCE(profile_effects, '{}'::jsonb), COALESCE(benefits, '{}'::jsonb)
FROM public.loyalty_levels
WHERE is_purchasable = true OR is_vip_plus = true OR COALESCE(purchase_price_points, 0) > 0;

CREATE TRIGGER trg_membership_cards_updated_at
BEFORE UPDATE ON public.membership_cards
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.membership_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view membership cards" ON public.membership_cards FOR SELECT USING (true);
CREATE POLICY "Admins can manage membership cards" ON public.membership_cards FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2) Reset user_cards
UPDATE public.card_gifts SET card_id = NULL WHERE card_id IS NOT NULL;
DELETE FROM public.card_discount_usage WHERE true;
DELETE FROM public.loyalty_percentage_discount_usage WHERE true;
DELETE FROM public.loyalty_free_shipping_usage WHERE true;
DELETE FROM public.user_cards WHERE true;

-- 3) Repoint user_cards
ALTER TABLE public.user_cards DROP CONSTRAINT IF EXISTS user_cards_level_id_fkey;
ALTER TABLE public.user_cards RENAME COLUMN level_id TO card_id;
ALTER TABLE public.user_cards
  ADD CONSTRAINT user_cards_card_id_fkey
  FOREIGN KEY (card_id) REFERENCES public.membership_cards(id) ON DELETE CASCADE;

-- 4) Repoint dependent tables
ALTER TABLE public.product_card_discounts
  DROP CONSTRAINT IF EXISTS product_card_discounts_level_id_fkey,
  DROP CONSTRAINT IF EXISTS product_card_discounts_product_id_level_id_key;
ALTER TABLE public.product_card_discounts RENAME COLUMN level_id TO card_id;
ALTER TABLE public.product_card_discounts
  ADD CONSTRAINT product_card_discounts_card_id_fkey
  FOREIGN KEY (card_id) REFERENCES public.membership_cards(id) ON DELETE CASCADE,
  ADD CONSTRAINT product_card_discounts_product_id_card_id_key UNIQUE (product_id, card_id);

ALTER TABLE public.card_discount_limits
  DROP CONSTRAINT IF EXISTS card_discount_limits_level_id_fkey,
  DROP CONSTRAINT IF EXISTS card_discount_limits_level_id_category_id_key;
ALTER TABLE public.card_discount_limits RENAME COLUMN level_id TO card_id;
ALTER TABLE public.card_discount_limits
  ADD CONSTRAINT card_discount_limits_card_id_fkey
  FOREIGN KEY (card_id) REFERENCES public.membership_cards(id) ON DELETE CASCADE,
  ADD CONSTRAINT card_discount_limits_card_id_category_id_key UNIQUE (card_id, category_id);

ALTER TABLE public.card_discount_usage
  DROP CONSTRAINT IF EXISTS card_discount_usage_level_id_fkey,
  DROP COLUMN IF EXISTS level_id;

ALTER TABLE public.card_gifts DROP CONSTRAINT IF EXISTS card_gifts_level_id_fkey;
ALTER TABLE public.card_gifts RENAME COLUMN level_id TO card_target_id;
ALTER TABLE public.card_gifts
  ADD CONSTRAINT card_gifts_card_target_id_fkey
  FOREIGN KEY (card_target_id) REFERENCES public.membership_cards(id);

ALTER TABLE public.card_exclusive_offers DROP CONSTRAINT IF EXISTS card_exclusive_offers_min_card_level_id_fkey;
ALTER TABLE public.card_exclusive_offers RENAME COLUMN min_card_level_id TO min_card_id;
ALTER TABLE public.card_exclusive_offers
  ADD CONSTRAINT card_exclusive_offers_min_card_id_fkey
  FOREIGN KEY (min_card_id) REFERENCES public.membership_cards(id);

ALTER TABLE public.loyalty_percentage_discount_usage DROP COLUMN IF EXISTS level_id;
ALTER TABLE public.loyalty_free_shipping_usage DROP COLUMN IF EXISTS level_id;

-- 5) Clean loyalty_levels
ALTER TABLE public.loyalty_levels
  DROP COLUMN IF EXISTS purchase_price_points,
  DROP COLUMN IF EXISTS wallet_price,
  DROP COLUMN IF EXISTS duration_days,
  DROP COLUMN IF EXISTS is_purchasable,
  DROP COLUMN IF EXISTS is_vip_plus,
  DROP COLUMN IF EXISTS discount_percentage,
  DROP COLUMN IF EXISTS discount_percentage_max_amount,
  DROP COLUMN IF EXISTS discount_applicable_category_ids,
  DROP COLUMN IF EXISTS card_discounts_enabled,
  DROP COLUMN IF EXISTS free_shipping,
  DROP COLUMN IF EXISTS free_shipping_min_order,
  DROP COLUMN IF EXISTS free_shipping_methods,
  DROP COLUMN IF EXISTS free_shipping_max_uses,
  DROP COLUMN IF EXISTS free_shipping_applicable_category_ids,
  DROP COLUMN IF EXISTS monthly_free_shipping,
  DROP COLUMN IF EXISTS frame_url,
  DROP COLUMN IF EXISTS frame_animation,
  DROP COLUMN IF EXISTS free_tickets_monthly,
  DROP COLUMN IF EXISTS free_daily_games,
  DROP COLUMN IF EXISTS vip_support,
  DROP COLUMN IF EXISTS priority_support,
  DROP COLUMN IF EXISTS priority_shipping,
  DROP COLUMN IF EXISTS priority_packaging,
  DROP COLUMN IF EXISTS early_access,
  DROP COLUMN IF EXISTS exclusive_products,
  DROP COLUMN IF EXISTS wholesale_discount_enabled,
  DROP COLUMN IF EXISTS investment_enabled,
  DROP COLUMN IF EXISTS special_name_style,
  DROP COLUMN IF EXISTS profile_effects;

-- 6) Recreate functions
CREATE OR REPLACE FUNCTION public.get_user_card_frame(p_user_id uuid)
RETURNS TABLE(frame_url text, frame_animation text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT mc.frame_url, mc.frame_animation
  FROM public.user_cards uc
  JOIN public.membership_cards mc ON mc.id = uc.card_id
  WHERE uc.user_id = p_user_id AND uc.is_active = true
    AND (uc.expires_at IS NULL OR uc.expires_at > now())
  ORDER BY uc.purchased_at DESC LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.check_vip_free_play(p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_cards uc
    JOIN public.membership_cards mc ON mc.id = uc.card_id
    WHERE uc.user_id = p_user_id AND uc.is_active = true AND mc.is_vip_plus = true
      AND (uc.expires_at IS NULL OR uc.expires_at > now())
  );
$$;

CREATE OR REPLACE FUNCTION public.get_card_percentage_discount_used(p_user_id uuid, p_card_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(COUNT(*)::int, 0) FROM public.loyalty_percentage_discount_usage
  WHERE user_id = p_user_id AND card_id = p_card_id;
$$;

CREATE OR REPLACE FUNCTION public.get_card_free_shipping_used(p_user_id uuid, p_card_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(COUNT(*)::int, 0) FROM public.loyalty_free_shipping_usage
  WHERE user_id = p_user_id AND card_id = p_card_id;
$$;

CREATE OR REPLACE FUNCTION public.check_card_discount(p_user_id uuid, p_card_id uuid, p_category_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_max_uses int; v_used int;
BEGIN
  SELECT max_uses INTO v_max_uses FROM public.card_discount_limits WHERE card_id = p_card_id AND category_id = p_category_id;
  IF v_max_uses IS NULL THEN RETURN jsonb_build_object('allowed', true, 'used', 0, 'limit', null); END IF;
  SELECT COUNT(*) INTO v_used FROM public.card_discount_usage WHERE user_id = p_user_id AND card_id = p_card_id AND category_id = p_category_id;
  RETURN jsonb_build_object('allowed', v_used < v_max_uses, 'used', v_used, 'limit', v_max_uses);
END;
$$;

CREATE OR REPLACE FUNCTION public.use_card_discount(p_user_id uuid, p_card_id uuid, p_category_id uuid, p_order_id uuid DEFAULT NULL)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ INSERT INTO public.card_discount_usage (user_id, card_id, category_id, order_id) VALUES (p_user_id, p_card_id, p_category_id, p_order_id); $$;

CREATE OR REPLACE FUNCTION public.purchase_card_with_points(p_user_id uuid, p_card_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_card public.membership_cards%ROWTYPE; v_available numeric; v_new_card_id uuid;
BEGIN
  SELECT * INTO v_card FROM public.membership_cards WHERE id = p_card_id AND is_active = true;
  IF v_card.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'البطاقة غير متوفرة'); END IF;
  SELECT available_points INTO v_available FROM public.user_points WHERE user_id = p_user_id FOR UPDATE;
  IF COALESCE(v_available, 0) < v_card.price_points THEN RETURN jsonb_build_object('success', false, 'error', 'النقاط غير كافية'); END IF;
  UPDATE public.user_points SET available_points = available_points - v_card.price_points, redeemed_points = COALESCE(redeemed_points, 0) + v_card.price_points WHERE user_id = p_user_id;
  UPDATE public.user_cards SET is_active = false WHERE user_id = p_user_id AND is_active = true;
  INSERT INTO public.user_cards (user_id, card_id, points_spent, is_active, expires_at, payment_method)
  VALUES (p_user_id, p_card_id, v_card.price_points, true,
    CASE WHEN v_card.duration_days > 0 THEN now() + make_interval(days => v_card.duration_days) ELSE NULL END, 'points')
  RETURNING id INTO v_new_card_id;
  RETURN jsonb_build_object('success', true, 'user_card_id', v_new_card_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.purchase_card_with_wallet(p_user_id uuid, p_card_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_card public.membership_cards%ROWTYPE; v_balance numeric; v_new_card_id uuid;
BEGIN
  SELECT * INTO v_card FROM public.membership_cards WHERE id = p_card_id AND is_active = true;
  IF v_card.id IS NULL OR v_card.wallet_price IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'البطاقة غير متوفرة للشراء بالمحفظة'); END IF;
  SELECT balance INTO v_balance FROM public.user_wallets WHERE user_id = p_user_id FOR UPDATE;
  IF COALESCE(v_balance, 0) < v_card.wallet_price THEN RETURN jsonb_build_object('success', false, 'error', 'الرصيد غير كافٍ'); END IF;
  UPDATE public.user_wallets SET balance = balance - v_card.wallet_price WHERE user_id = p_user_id;
  UPDATE public.user_cards SET is_active = false WHERE user_id = p_user_id AND is_active = true;
  INSERT INTO public.user_cards (user_id, card_id, wallet_amount_paid, is_active, expires_at, payment_method)
  VALUES (p_user_id, p_card_id, v_card.wallet_price, true,
    CASE WHEN v_card.duration_days > 0 THEN now() + make_interval(days => v_card.duration_days) ELSE NULL END, 'wallet')
  RETURNING id INTO v_new_card_id;
  RETURN jsonb_build_object('success', true, 'user_card_id', v_new_card_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.gift_card_with_points(p_gifter_id uuid, p_recipient_id uuid, p_card_id uuid, p_message text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_card public.membership_cards%ROWTYPE; v_available numeric; v_new_card_id uuid;
BEGIN
  SELECT * INTO v_card FROM public.membership_cards WHERE id = p_card_id AND is_active = true;
  IF v_card.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'البطاقة غير متوفرة'); END IF;
  SELECT available_points INTO v_available FROM public.user_points WHERE user_id = p_gifter_id FOR UPDATE;
  IF COALESCE(v_available, 0) < v_card.price_points THEN RETURN jsonb_build_object('success', false, 'error', 'النقاط غير كافية'); END IF;
  UPDATE public.user_points SET available_points = available_points - v_card.price_points, redeemed_points = COALESCE(redeemed_points, 0) + v_card.price_points WHERE user_id = p_gifter_id;
  UPDATE public.user_cards SET is_active = false WHERE user_id = p_recipient_id AND is_active = true;
  INSERT INTO public.user_cards (user_id, card_id, points_spent, is_active, expires_at, payment_method)
  VALUES (p_recipient_id, p_card_id, v_card.price_points, true,
    CASE WHEN v_card.duration_days > 0 THEN now() + make_interval(days => v_card.duration_days) ELSE NULL END, 'points_gift')
  RETURNING id INTO v_new_card_id;
  INSERT INTO public.card_gifts (gifter_id, recipient_id, card_target_id, payment_method, amount_paid, card_id, message)
  VALUES (p_gifter_id, p_recipient_id, p_card_id, 'points', v_card.price_points, v_new_card_id, p_message);
  RETURN jsonb_build_object('success', true, 'user_card_id', v_new_card_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.gift_card_with_wallet(p_gifter_id uuid, p_recipient_id uuid, p_card_id uuid, p_message text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_card public.membership_cards%ROWTYPE; v_balance numeric; v_new_card_id uuid;
BEGIN
  SELECT * INTO v_card FROM public.membership_cards WHERE id = p_card_id AND is_active = true;
  IF v_card.id IS NULL OR v_card.wallet_price IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'البطاقة غير متوفرة للشراء بالمحفظة'); END IF;
  SELECT balance INTO v_balance FROM public.user_wallets WHERE user_id = p_gifter_id FOR UPDATE;
  IF COALESCE(v_balance, 0) < v_card.wallet_price THEN RETURN jsonb_build_object('success', false, 'error', 'الرصيد غير كافٍ'); END IF;
  UPDATE public.user_wallets SET balance = balance - v_card.wallet_price WHERE user_id = p_gifter_id;
  UPDATE public.user_cards SET is_active = false WHERE user_id = p_recipient_id AND is_active = true;
  INSERT INTO public.user_cards (user_id, card_id, wallet_amount_paid, is_active, expires_at, payment_method)
  VALUES (p_recipient_id, p_card_id, v_card.wallet_price, true,
    CASE WHEN v_card.duration_days > 0 THEN now() + make_interval(days => v_card.duration_days) ELSE NULL END, 'wallet_gift')
  RETURNING id INTO v_new_card_id;
  INSERT INTO public.card_gifts (gifter_id, recipient_id, card_target_id, payment_method, amount_paid, card_id, message)
  VALUES (p_gifter_id, p_recipient_id, p_card_id, 'wallet', v_card.wallet_price, v_new_card_id, p_message);
  RETURN jsonb_build_object('success', true, 'user_card_id', v_new_card_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_gift_loyalty_card(p_user_id uuid, p_card_id uuid, p_admin_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_card public.membership_cards%ROWTYPE; v_new_card_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RETURN jsonb_build_object('success', false, 'error', 'غير مسموح'); END IF;
  SELECT * INTO v_card FROM public.membership_cards WHERE id = p_card_id;
  IF v_card.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'البطاقة غير موجودة'); END IF;
  UPDATE public.user_cards SET is_active = false WHERE user_id = p_user_id AND is_active = true;
  INSERT INTO public.user_cards (user_id, card_id, is_active, expires_at, payment_method)
  VALUES (p_user_id, p_card_id, true,
    CASE WHEN v_card.duration_days > 0 THEN now() + make_interval(days => v_card.duration_days) ELSE NULL END, 'admin_gift')
  RETURNING id INTO v_new_card_id;
  RETURN jsonb_build_object('success', true, 'user_card_id', v_new_card_id);
END;
$$;
