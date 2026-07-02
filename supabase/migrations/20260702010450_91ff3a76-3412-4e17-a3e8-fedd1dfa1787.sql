
-- ============================================================
-- LEVO CARD SYSTEM — Full rebuild
-- ============================================================

-- 1) Drop old system
DROP FUNCTION IF EXISTS public.redeem_loyalty_card_code(text) CASCADE;
DROP FUNCTION IF EXISTS public.expire_loyalty_card_codes() CASCADE;
DROP FUNCTION IF EXISTS public.expire_loyalty_codes_and_cards() CASCADE;
DROP FUNCTION IF EXISTS public.create_loyalty_code_batch(uuid, integer, integer, timestamp with time zone, text, boolean, timestamp with time zone) CASCADE;
DROP FUNCTION IF EXISTS public.create_loyalty_code_batch(uuid, integer, integer, timestamp with time zone, text, boolean) CASCADE;
DROP FUNCTION IF EXISTS public.generate_loyalty_code(integer) CASCADE;
DROP TABLE IF EXISTS public.loyalty_card_codes CASCADE;

-- Wipe user_cards (clean slate for new system)
DELETE FROM public.user_cards WHERE true;

-- 2) Physical cards inventory
CREATE TABLE public.levo_physical_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_number text NOT NULL UNIQUE,
  card_number_last4 text NOT NULL,
  batch_label text,
  status text NOT NULL DEFAULT 'unassigned' CHECK (status IN ('unassigned','assigned','revoked')),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_levo_cards_status ON public.levo_physical_cards(status);
CREATE INDEX idx_levo_cards_batch ON public.levo_physical_cards(batch_label);

GRANT SELECT ON public.levo_physical_cards TO authenticated;
GRANT ALL ON public.levo_physical_cards TO service_role;
ALTER TABLE public.levo_physical_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage levo cards" ON public.levo_physical_cards
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 3) Card ↔ User assignments (one active per card, one active per user)
CREATE TABLE public.levo_card_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.levo_physical_cards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  release_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- one active assignment per card
CREATE UNIQUE INDEX ux_levo_assignments_card_active ON public.levo_card_assignments(card_id) WHERE released_at IS NULL;
-- one active assignment per user (a user can hold only one levo card)
CREATE UNIQUE INDEX ux_levo_assignments_user_active ON public.levo_card_assignments(user_id) WHERE released_at IS NULL;
CREATE INDEX idx_levo_assignments_user ON public.levo_card_assignments(user_id);

GRANT SELECT ON public.levo_card_assignments TO authenticated;
GRANT ALL ON public.levo_card_assignments TO service_role;
ALTER TABLE public.levo_card_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own assignments" ON public.levo_card_assignments
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage assignments" ON public.levo_card_assignments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 4) Subscriptions per assignment
CREATE TABLE public.levo_card_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.levo_card_assignments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  membership_card_id uuid NOT NULL REFERENCES public.membership_cards(id),
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','cancelled','upgraded')),
  paid_amount numeric NOT NULL DEFAULT 0,
  payment_method text,
  source_order_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_levo_sub_active ON public.levo_card_subscriptions(assignment_id) WHERE status = 'active';
CREATE INDEX idx_levo_sub_user ON public.levo_card_subscriptions(user_id);
CREATE INDEX idx_levo_sub_membership ON public.levo_card_subscriptions(membership_card_id);

GRANT SELECT ON public.levo_card_subscriptions TO authenticated;
GRANT ALL ON public.levo_card_subscriptions TO service_role;
ALTER TABLE public.levo_card_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own subs" ON public.levo_card_subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage subs" ON public.levo_card_subscriptions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 5) History (upgrades log)
CREATE TABLE public.levo_card_subscription_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid REFERENCES public.levo_card_subscriptions(id) ON DELETE SET NULL,
  new_subscription_id uuid REFERENCES public.levo_card_subscriptions(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  previous_plan_id uuid,
  new_plan_id uuid,
  days_used integer,
  days_remaining integer,
  credit_applied numeric,
  difference_paid numeric,
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.levo_card_subscription_history TO authenticated;
GRANT ALL ON public.levo_card_subscription_history TO service_role;
ALTER TABLE public.levo_card_subscription_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own history" ON public.levo_card_subscription_history
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all history" ON public.levo_card_subscription_history
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 6) Coupons flag for Levo-card-only coupons
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS applies_to_levo_card_only boolean NOT NULL DEFAULT false;

-- 7) Default settings pointer to the physical-card product
ALTER TABLE public.default_settings ADD COLUMN IF NOT EXISTS levo_physical_card_product_id uuid;

-- 8) Triggers: updated_at
CREATE TRIGGER trg_levo_cards_updated BEFORE UPDATE ON public.levo_physical_cards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_levo_assignments_updated BEFORE UPDATE ON public.levo_card_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_levo_subs_updated BEFORE UPDATE ON public.levo_card_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9) Helpers
CREATE OR REPLACE FUNCTION public.normalize_levo_card_number(p_input text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT regexp_replace(coalesce(p_input,''), '[^0-9]', '', 'g');
$$;

CREATE OR REPLACE FUNCTION public.generate_levo_card_number()
RETURNS text LANGUAGE plpgsql AS $$
DECLARE v_num text; v_exists boolean;
BEGIN
  LOOP
    v_num := '';
    FOR i IN 1..16 LOOP v_num := v_num || floor(random()*10)::int::text; END LOOP;
    SELECT EXISTS(SELECT 1 FROM public.levo_physical_cards WHERE card_number = v_num) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  RETURN v_num;
END;
$$;

-- 10) RPC: user activates a card
CREATE OR REPLACE FUNCTION public.levo_activate_card(p_card_number text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_num text;
  v_card public.levo_physical_cards%ROWTYPE;
  v_assignment_id uuid;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'unauthenticated'); END IF;
  v_num := public.normalize_levo_card_number(p_card_number);
  IF length(v_num) <> 16 THEN RETURN jsonb_build_object('success', false, 'error', 'invalid_length'); END IF;

  SELECT * INTO v_card FROM public.levo_physical_cards WHERE card_number = v_num FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'not_found'); END IF;
  IF v_card.status = 'revoked' THEN RETURN jsonb_build_object('success', false, 'error', 'revoked'); END IF;

  -- reject if this card is already active on someone
  IF EXISTS(SELECT 1 FROM public.levo_card_assignments WHERE card_id = v_card.id AND released_at IS NULL) THEN
    RETURN jsonb_build_object('success', false, 'error', 'card_in_use');
  END IF;

  -- reject if the user already has an active levo card
  IF EXISTS(SELECT 1 FROM public.levo_card_assignments WHERE user_id = v_uid AND released_at IS NULL) THEN
    RETURN jsonb_build_object('success', false, 'error', 'user_has_card');
  END IF;

  INSERT INTO public.levo_card_assignments(card_id, user_id) VALUES (v_card.id, v_uid)
    RETURNING id INTO v_assignment_id;
  UPDATE public.levo_physical_cards SET status='assigned', updated_at=now() WHERE id = v_card.id;

  RETURN jsonb_build_object('success', true, 'assignment_id', v_assignment_id, 'card_id', v_card.id, 'last4', v_card.card_number_last4);
END; $$;

GRANT EXECUTE ON FUNCTION public.levo_activate_card(text) TO authenticated;

-- 11) RPC: user releases their own card
CREATE OR REPLACE FUNCTION public.levo_release_card(p_assignment_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_a public.levo_card_assignments%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'unauthenticated'); END IF;
  SELECT * INTO v_a FROM public.levo_card_assignments WHERE id = p_assignment_id FOR UPDATE;
  IF NOT FOUND OR v_a.released_at IS NOT NULL THEN RETURN jsonb_build_object('success', false, 'error', 'not_found'); END IF;
  IF v_a.user_id <> v_uid AND NOT public.has_role(v_uid, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  UPDATE public.levo_card_assignments SET released_at = now(), release_reason = 'user_removed', updated_at=now()
    WHERE id = v_a.id;
  UPDATE public.levo_card_subscriptions SET status='cancelled', updated_at=now()
    WHERE assignment_id = v_a.id AND status='active';
  UPDATE public.levo_physical_cards SET status='unassigned', updated_at=now() WHERE id = v_a.card_id;

  INSERT INTO public.levo_card_subscription_history(user_id, action) VALUES (v_a.user_id, 'released');
  RETURN jsonb_build_object('success', true);
END; $$;

GRANT EXECUTE ON FUNCTION public.levo_release_card(uuid) TO authenticated;

-- 12) RPC: subscribe a plan to a card
CREATE OR REPLACE FUNCTION public.levo_subscribe_card(
  p_assignment_id uuid, p_membership_card_id uuid, p_payment_method text, p_amount numeric
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_a public.levo_card_assignments%ROWTYPE;
  v_plan public.membership_cards%ROWTYPE;
  v_sub_id uuid;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('success', false, 'error','unauthenticated'); END IF;
  SELECT * INTO v_a FROM public.levo_card_assignments WHERE id = p_assignment_id AND released_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error','assignment_not_found'); END IF;
  IF v_a.user_id <> v_uid AND NOT public.has_role(v_uid, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error','forbidden');
  END IF;
  IF EXISTS(SELECT 1 FROM public.levo_card_subscriptions WHERE assignment_id = v_a.id AND status='active') THEN
    RETURN jsonb_build_object('success', false, 'error','already_subscribed');
  END IF;
  SELECT * INTO v_plan FROM public.membership_cards WHERE id = p_membership_card_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error','plan_not_found'); END IF;

  INSERT INTO public.levo_card_subscriptions(
    assignment_id, user_id, membership_card_id, expires_at, paid_amount, payment_method
  ) VALUES (
    v_a.id, v_a.user_id, v_plan.id, now() + (v_plan.duration_days || ' days')::interval, coalesce(p_amount, 0), p_payment_method
  ) RETURNING id INTO v_sub_id;

  INSERT INTO public.levo_card_subscription_history(new_subscription_id, user_id, new_plan_id, action)
    VALUES (v_sub_id, v_a.user_id, v_plan.id, 'subscribed');

  RETURN jsonb_build_object('success', true, 'subscription_id', v_sub_id);
END; $$;

GRANT EXECUTE ON FUNCTION public.levo_subscribe_card(uuid, uuid, text, numeric) TO authenticated;

-- 13) RPC: upgrade subscription (compute prorated credit)
CREATE OR REPLACE FUNCTION public.levo_upgrade_quote(p_assignment_id uuid, p_new_plan_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_a public.levo_card_assignments%ROWTYPE;
  v_sub public.levo_card_subscriptions%ROWTYPE;
  v_cur public.membership_cards%ROWTYPE;
  v_new public.membership_cards%ROWTYPE;
  v_days_used integer;
  v_days_remaining integer;
  v_credit numeric;
  v_final numeric;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('success', false, 'error','unauthenticated'); END IF;
  SELECT * INTO v_a FROM public.levo_card_assignments WHERE id = p_assignment_id AND released_at IS NULL;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error','not_found'); END IF;
  IF v_a.user_id <> v_uid AND NOT public.has_role(v_uid,'admin') THEN
    RETURN jsonb_build_object('success', false, 'error','forbidden');
  END IF;
  SELECT * INTO v_sub FROM public.levo_card_subscriptions WHERE assignment_id = v_a.id AND status='active';
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error','no_active_sub'); END IF;
  SELECT * INTO v_cur FROM public.membership_cards WHERE id = v_sub.membership_card_id;
  SELECT * INTO v_new FROM public.membership_cards WHERE id = p_new_plan_id;
  IF v_new.display_order <= v_cur.display_order THEN
    RETURN jsonb_build_object('success', false, 'error','downgrade_not_allowed');
  END IF;

  v_days_used := GREATEST(0, EXTRACT(DAY FROM (now() - v_sub.started_at))::integer);
  v_days_remaining := GREATEST(0, v_cur.duration_days - v_days_used);
  v_credit := ROUND( coalesce(v_sub.paid_amount,0) * (v_days_remaining::numeric / NULLIF(v_cur.duration_days,0)) );
  v_final := GREATEST(0, coalesce(v_new.wallet_price, 0) - v_credit);

  RETURN jsonb_build_object(
    'success', true,
    'current_plan_id', v_cur.id, 'new_plan_id', v_new.id,
    'days_used', v_days_used, 'days_remaining', v_days_remaining,
    'current_paid', v_sub.paid_amount,
    'new_price', v_new.wallet_price,
    'credit', v_credit,
    'amount_due', v_final
  );
END; $$;
GRANT EXECUTE ON FUNCTION public.levo_upgrade_quote(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.levo_upgrade_subscription(
  p_assignment_id uuid, p_new_plan_id uuid, p_payment_method text, p_amount_paid numeric
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_a public.levo_card_assignments%ROWTYPE;
  v_sub public.levo_card_subscriptions%ROWTYPE;
  v_cur public.membership_cards%ROWTYPE;
  v_new public.membership_cards%ROWTYPE;
  v_days_used integer; v_days_remaining integer; v_credit numeric;
  v_new_id uuid;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('success', false, 'error','unauthenticated'); END IF;
  SELECT * INTO v_a FROM public.levo_card_assignments WHERE id = p_assignment_id AND released_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error','not_found'); END IF;
  IF v_a.user_id <> v_uid AND NOT public.has_role(v_uid,'admin') THEN
    RETURN jsonb_build_object('success', false, 'error','forbidden');
  END IF;
  SELECT * INTO v_sub FROM public.levo_card_subscriptions WHERE assignment_id = v_a.id AND status='active' FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error','no_active_sub'); END IF;
  SELECT * INTO v_cur FROM public.membership_cards WHERE id = v_sub.membership_card_id;
  SELECT * INTO v_new FROM public.membership_cards WHERE id = p_new_plan_id;
  IF v_new.display_order <= v_cur.display_order THEN
    RETURN jsonb_build_object('success', false, 'error','downgrade_not_allowed');
  END IF;

  v_days_used := GREATEST(0, EXTRACT(DAY FROM (now() - v_sub.started_at))::integer);
  v_days_remaining := GREATEST(0, v_cur.duration_days - v_days_used);
  v_credit := ROUND( coalesce(v_sub.paid_amount,0) * (v_days_remaining::numeric / NULLIF(v_cur.duration_days,0)) );

  UPDATE public.levo_card_subscriptions SET status='upgraded', updated_at=now() WHERE id = v_sub.id;

  INSERT INTO public.levo_card_subscriptions(
    assignment_id, user_id, membership_card_id, expires_at, paid_amount, payment_method, notes
  ) VALUES (
    v_a.id, v_a.user_id, v_new.id, now() + (v_new.duration_days || ' days')::interval, coalesce(p_amount_paid,0), p_payment_method,
    'upgrade credit: ' || v_credit::text
  ) RETURNING id INTO v_new_id;

  INSERT INTO public.levo_card_subscription_history(
    subscription_id, new_subscription_id, user_id, previous_plan_id, new_plan_id,
    days_used, days_remaining, credit_applied, difference_paid, action
  ) VALUES (
    v_sub.id, v_new_id, v_a.user_id, v_cur.id, v_new.id,
    v_days_used, v_days_remaining, v_credit, p_amount_paid, 'upgraded'
  );

  RETURN jsonb_build_object('success', true, 'subscription_id', v_new_id, 'credit_applied', v_credit);
END; $$;
GRANT EXECUTE ON FUNCTION public.levo_upgrade_subscription(uuid, uuid, text, numeric) TO authenticated;

-- 14) Admin RPCs
CREATE OR REPLACE FUNCTION public.admin_generate_levo_cards(p_count integer, p_batch_label text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_i integer; v_num text; v_ids uuid[] := ARRAY[]::uuid[]; v_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RETURN jsonb_build_object('success', false, 'error','forbidden');
  END IF;
  IF coalesce(p_count,0) < 1 OR p_count > 5000 THEN
    RETURN jsonb_build_object('success', false, 'error','invalid_count');
  END IF;
  FOR v_i IN 1..p_count LOOP
    v_num := public.generate_levo_card_number();
    INSERT INTO public.levo_physical_cards(card_number, card_number_last4, batch_label, created_by)
      VALUES (v_num, right(v_num, 4), p_batch_label, auth.uid())
      RETURNING id INTO v_id;
    v_ids := v_ids || v_id;
  END LOOP;
  RETURN jsonb_build_object('success', true, 'count', p_count, 'ids', v_ids);
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_generate_levo_cards(integer, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_levo_card_details(p_card_number text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_num text;
  v_card public.levo_physical_cards%ROWTYPE;
  v_a public.levo_card_assignments%ROWTYPE;
  v_profile jsonb;
  v_subs jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RETURN jsonb_build_object('success', false, 'error','forbidden');
  END IF;
  v_num := public.normalize_levo_card_number(p_card_number);
  SELECT * INTO v_card FROM public.levo_physical_cards WHERE card_number = v_num;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error','not_found'); END IF;
  SELECT * INTO v_a FROM public.levo_card_assignments WHERE card_id = v_card.id AND released_at IS NULL;
  IF FOUND THEN
    SELECT to_jsonb(p) INTO v_profile FROM (
      SELECT id, username, full_name, avatar_url FROM public.profiles WHERE id = v_a.user_id
    ) p;
    SELECT jsonb_agg(to_jsonb(s) ORDER BY s.created_at DESC) INTO v_subs FROM public.levo_card_subscriptions s WHERE s.assignment_id = v_a.id;
  END IF;
  RETURN jsonb_build_object(
    'success', true,
    'card', to_jsonb(v_card),
    'assignment', to_jsonb(v_a),
    'user', v_profile,
    'subscriptions', coalesce(v_subs, '[]'::jsonb)
  );
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_get_levo_card_details(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_release_levo_card(p_assignment_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_a public.levo_card_assignments%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RETURN jsonb_build_object('success', false, 'error','forbidden'); END IF;
  SELECT * INTO v_a FROM public.levo_card_assignments WHERE id = p_assignment_id FOR UPDATE;
  IF NOT FOUND OR v_a.released_at IS NOT NULL THEN RETURN jsonb_build_object('success', false, 'error','not_found'); END IF;
  UPDATE public.levo_card_assignments SET released_at = now(), release_reason = 'admin_removed', updated_at=now() WHERE id = v_a.id;
  UPDATE public.levo_card_subscriptions SET status='cancelled', updated_at=now() WHERE assignment_id = v_a.id AND status='active';
  UPDATE public.levo_physical_cards SET status='unassigned', updated_at=now() WHERE id = v_a.card_id;
  RETURN jsonb_build_object('success', true);
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_release_levo_card(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_levo_card(p_card_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RETURN jsonb_build_object('success', false, 'error','forbidden'); END IF;
  DELETE FROM public.levo_physical_cards WHERE id = p_card_id;
  RETURN jsonb_build_object('success', true);
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_delete_levo_card(uuid) TO authenticated;
