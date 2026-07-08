
ALTER TABLE public.points_transactions DROP CONSTRAINT IF EXISTS points_transactions_source_check;
ALTER TABLE public.points_transactions ADD CONSTRAINT points_transactions_source_check CHECK (
  source = ANY (ARRAY[
    'order','order_delivered','review','coupon','cash','daily_task','referral','referred',
    'verified_review','wallet_conversion','admin_adjustment','tickets_conversion','avatar_frame',
    'spend','frame_purchase','rating','merchant_rating','game_store','offer_purchase',
    'cart_redemption','order_backfill'
  ])
);

DROP TRIGGER IF EXISTS award_points_on_order_delivery ON public.orders;
DROP TRIGGER IF EXISTS award_points_on_delivery_trigger ON public.orders;
DROP FUNCTION IF EXISTS public.award_points_on_delivery() CASCADE;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS points_redeemed INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS points_discount_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS points_earned INTEGER NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.award_points_on_confirm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  base NUMERIC;
  bonus_pct NUMERIC := 0;
  total_points NUMERIC := 0;
  settings_data JSONB;
  points_enabled TEXT;
  already_count INT := 0;
BEGIN
  IF NOT (
    (NEW.user_confirmed_delivery = true AND COALESCE(OLD.user_confirmed_delivery,false) = false)
    OR (NEW.auto_confirmed = true AND COALESCE(OLD.auto_confirmed,false) = false)
  ) THEN RETURN NEW; END IF;
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO already_count FROM public.points_transactions
   WHERE related_id = NEW.id AND source IN ('order','order_delivered','order_backfill') AND points > 0;
  IF already_count > 0 THEN RETURN NEW; END IF;

  SELECT setting_value INTO settings_data FROM public.default_settings WHERE setting_key='points_settings';
  points_enabled := COALESCE(settings_data->>'points_status','enabled');
  IF points_enabled NOT IN ('enabled','active') THEN RETURN NEW; END IF;

  base := GREATEST(0, COALESCE(NEW.subtotal,0) - COALESCE(NEW.discount_amount,0));
  total_points := FLOOR(base / 1000);

  SELECT COALESCE(mc.bonus_points_percentage,0) INTO bonus_pct
  FROM public.user_cards uc JOIN public.membership_cards mc ON mc.id=uc.card_id
  WHERE uc.user_id=NEW.user_id AND uc.is_active=true AND (uc.expires_at IS NULL OR uc.expires_at>now())
  ORDER BY mc.bonus_points_percentage DESC NULLS LAST LIMIT 1;
  IF bonus_pct > 0 THEN total_points := total_points + FLOOR(total_points * bonus_pct / 100); END IF;

  IF total_points <= 0 THEN RETURN NEW; END IF;

  INSERT INTO public.user_points (user_id, total_points, available_points)
  VALUES (NEW.user_id, total_points, total_points)
  ON CONFLICT (user_id) DO UPDATE
  SET total_points = public.user_points.total_points + EXCLUDED.total_points,
      available_points = public.user_points.available_points + EXCLUDED.available_points,
      updated_at = now();

  INSERT INTO public.points_transactions (user_id, points, type, source, related_id, description)
  VALUES (NEW.user_id, total_points, 'earned', 'order_delivered', NEW.id,
          'نقاط من طلب رقم ' || COALESCE(NEW.order_number, NEW.id::text));

  UPDATE public.orders SET points_earned = total_points WHERE id = NEW.id;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS award_points_on_confirm_trigger ON public.orders;
CREATE TRIGGER award_points_on_confirm_trigger
AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.award_points_on_confirm();

CREATE OR REPLACE FUNCTION public.redeem_points_in_cart(p_order_id uuid, p_points integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_available numeric;
  v_owner uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF p_points IS NULL OR p_points <= 0 THEN RETURN false; END IF;

  SELECT user_id INTO v_owner FROM public.orders WHERE id=p_order_id FOR UPDATE;
  IF v_owner IS NULL OR v_owner <> v_user THEN RAISE EXCEPTION 'order not found or not owned by caller'; END IF;

  SELECT available_points INTO v_available FROM public.user_points WHERE user_id=v_user FOR UPDATE;
  IF COALESCE(v_available,0) < p_points THEN RAISE EXCEPTION 'insufficient points'; END IF;

  UPDATE public.user_points
     SET available_points = available_points - p_points,
         redeemed_points  = COALESCE(redeemed_points,0) + p_points,
         updated_at = now()
   WHERE user_id = v_user;

  INSERT INTO public.points_transactions (user_id, points, type, source, related_id, description)
  VALUES (v_user, -p_points, 'spend', 'cart_redemption', p_order_id, 'خصم نقاط في السلة');

  UPDATE public.orders
     SET points_redeemed = COALESCE(points_redeemed,0) + p_points,
         points_discount_amount = COALESCE(points_discount_amount,0) + p_points
   WHERE id = p_order_id;

  RETURN true;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.redeem_points_in_cart(uuid, integer) TO authenticated;

UPDATE public.products SET points_reward = 0 WHERE COALESCE(points_reward,0) <> 0;
UPDATE public.product_offers SET points_reward = 0 WHERE COALESCE(points_reward,0) <> 0;

DO $$
DECLARE
  r RECORD; base NUMERIC; should_earn NUMERIC; already NUMERIC; diff NUMERIC; bonus_pct NUMERIC;
BEGIN
  FOR r IN SELECT id, user_id, order_number, subtotal, discount_amount FROM public.orders WHERE status='delivered' AND user_id IS NOT NULL LOOP
    base := GREATEST(0, COALESCE(r.subtotal,0) - COALESCE(r.discount_amount,0));
    should_earn := FLOOR(base / 1000);
    SELECT COALESCE(mc.bonus_points_percentage,0) INTO bonus_pct
    FROM public.user_cards uc JOIN public.membership_cards mc ON mc.id=uc.card_id
    WHERE uc.user_id=r.user_id AND uc.is_active=true AND (uc.expires_at IS NULL OR uc.expires_at>now())
    ORDER BY mc.bonus_points_percentage DESC NULLS LAST LIMIT 1;
    bonus_pct := COALESCE(bonus_pct,0);
    IF bonus_pct > 0 THEN should_earn := should_earn + FLOOR(should_earn * bonus_pct / 100); END IF;

    SELECT COALESCE(SUM(points),0) INTO already FROM public.points_transactions
     WHERE related_id=r.id AND source IN ('order','order_delivered','order_backfill') AND points>0;

    diff := should_earn - already;
    IF diff > 0 THEN
      INSERT INTO public.user_points (user_id, total_points, available_points)
      VALUES (r.user_id, diff, diff)
      ON CONFLICT (user_id) DO UPDATE
      SET total_points = public.user_points.total_points + EXCLUDED.total_points,
          available_points = public.user_points.available_points + EXCLUDED.available_points,
          updated_at = now();
      INSERT INTO public.points_transactions (user_id, points, type, source, related_id, description)
      VALUES (r.user_id, diff, 'earned', 'order_backfill', r.id,
              'تعويض نظام النقاط الجديد - طلب ' || COALESCE(r.order_number, r.id::text));
      UPDATE public.orders SET points_earned = should_earn WHERE id=r.id;
    ELSE
      UPDATE public.orders SET points_earned = GREATEST(COALESCE(points_earned,0), should_earn) WHERE id=r.id;
    END IF;
  END LOOP;
END $$;
