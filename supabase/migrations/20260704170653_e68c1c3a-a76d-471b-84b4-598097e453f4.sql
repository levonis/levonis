
-- 1) Duration tiers table
CREATE TABLE IF NOT EXISTS public.subscription_duration_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type text NOT NULL CHECK (target_type IN ('card','protection_plan')),
  duration_months integer NOT NULL CHECK (duration_months IN (1,3,6,12)),
  discount_percentage numeric(5,2) NOT NULL DEFAULT 0 CHECK (discount_percentage >= 0 AND discount_percentage <= 90),
  label_ar text,
  label_en text,
  label_ku text,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (target_type, duration_months)
);

GRANT SELECT ON public.subscription_duration_tiers TO anon, authenticated;
GRANT ALL ON public.subscription_duration_tiers TO service_role;
ALTER TABLE public.subscription_duration_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active tiers" ON public.subscription_duration_tiers
  FOR SELECT USING (is_active = true OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage tiers" ON public.subscription_duration_tiers
  FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_sdt_updated_at ON public.subscription_duration_tiers;
CREATE TRIGGER trg_sdt_updated_at BEFORE UPDATE ON public.subscription_duration_tiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed defaults (only if empty)
INSERT INTO public.subscription_duration_tiers (target_type, duration_months, discount_percentage, label_ar, label_en, label_ku, display_order) VALUES
  ('card',1,0,'شهر واحد','1 Month','مانگێک',1),
  ('card',3,5,'٣ أشهر','3 Months','٣ مانگ',2),
  ('card',6,10,'٦ أشهر','6 Months','٦ مانگ',3),
  ('card',12,20,'سنة كاملة','12 Months','ساڵێک',4),
  ('protection_plan',1,0,'شهر واحد','1 Month','مانگێک',1),
  ('protection_plan',3,5,'٣ أشهر','3 Months','٣ مانگ',2),
  ('protection_plan',6,10,'٦ أشهر','6 Months','٦ مانگ',3),
  ('protection_plan',12,20,'سنة كاملة','12 Months','ساڵێک',4)
ON CONFLICT (target_type, duration_months) DO NOTHING;

-- 2) Extend subscription tables
ALTER TABLE public.levo_card_subscriptions
  ADD COLUMN IF NOT EXISTS duration_months integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS discount_percentage_applied numeric(5,2) NOT NULL DEFAULT 0;

ALTER TABLE public.printer_subscriptions
  ADD COLUMN IF NOT EXISTS duration_months integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS discount_percentage_applied numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_paid numeric NOT NULL DEFAULT 0;

-- 3) Update levo_subscribe_card to accept duration_months
CREATE OR REPLACE FUNCTION public.levo_subscribe_card(
  p_assignment_id uuid,
  p_membership_card_id uuid,
  p_payment_method text,
  p_amount numeric,
  p_duration_months integer DEFAULT 1,
  p_discount_percentage numeric DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_a public.levo_card_assignments%ROWTYPE;
  v_plan public.membership_cards%ROWTYPE;
  v_sub_id uuid;
  v_months integer := GREATEST(1, COALESCE(p_duration_months,1));
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
    assignment_id, user_id, membership_card_id, expires_at, paid_amount, payment_method,
    duration_months, discount_percentage_applied
  ) VALUES (
    v_a.id, v_a.user_id, v_plan.id,
    now() + ((v_plan.duration_days * v_months) || ' days')::interval,
    COALESCE(p_amount, 0), p_payment_method,
    v_months, COALESCE(p_discount_percentage,0)
  ) RETURNING id INTO v_sub_id;

  INSERT INTO public.levo_card_subscription_history(new_subscription_id, user_id, new_plan_id, action)
    VALUES (v_sub_id, v_a.user_id, v_plan.id, 'subscribed');

  RETURN jsonb_build_object('success', true, 'subscription_id', v_sub_id);
END; $$;

-- 4) subscribe_protection_plan (wallet deduction + create printer_subscription)
CREATE OR REPLACE FUNCTION public.subscribe_protection_plan(
  p_plan_id uuid,
  p_user_printer_id uuid,
  p_duration_months integer,
  p_expected_total numeric,
  p_discount_percentage numeric DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_plan public.protection_plans%ROWTYPE;
  v_printer public.user_printers%ROWTYPE;
  v_wallet public.user_wallets%ROWTYPE;
  v_months integer := GREATEST(1, COALESCE(p_duration_months,1));
  v_gross numeric;
  v_final numeric;
  v_disc numeric := COALESCE(p_discount_percentage,0);
  v_sub_id uuid;
  v_now timestamptz := now();
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('success',false,'error','unauthenticated'); END IF;

  SELECT * INTO v_plan FROM public.protection_plans WHERE id = p_plan_id AND is_active = true;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','plan_not_found'); END IF;

  SELECT * INTO v_printer FROM public.user_printers WHERE id = p_user_printer_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','printer_not_found'); END IF;
  IF v_printer.user_id <> v_uid THEN RETURN jsonb_build_object('success',false,'error','forbidden'); END IF;

  IF EXISTS(
    SELECT 1 FROM public.printer_subscriptions
    WHERE user_printer_id = v_printer.id AND status = 'active'
      AND (end_date IS NULL OR end_date > v_now)
  ) THEN
    RETURN jsonb_build_object('success',false,'error','printer_already_subscribed');
  END IF;

  v_gross := COALESCE(v_plan.monthly_price,0) * v_months;
  v_final := FLOOR((v_gross * (100 - v_disc) / 100) / 250) * 250;
  IF v_final < 0 THEN v_final := 0; END IF;

  -- Verify expected total to avoid stale UI
  IF p_expected_total IS NOT NULL AND ABS(p_expected_total - v_final) > 250 THEN
    RETURN jsonb_build_object('success',false,'error','price_mismatch','server_total',v_final);
  END IF;

  SELECT * INTO v_wallet FROM public.user_wallets WHERE user_id = v_uid FOR UPDATE;
  IF NOT FOUND OR COALESCE(v_wallet.balance,0) < v_final THEN
    RETURN jsonb_build_object('success',false,'error','insufficient_wallet','required',v_final,'balance',COALESCE(v_wallet.balance,0));
  END IF;

  UPDATE public.user_wallets SET balance = balance - v_final, updated_at = v_now WHERE user_id = v_uid;

  INSERT INTO public.wallet_transactions(user_id, type, amount, status, description, balance_before, balance_after, payment_method)
  VALUES (v_uid, 'debit', v_final, 'completed',
          'اشتراك خطة حماية: ' || v_plan.name_ar || ' (' || v_months || ' شهر)',
          v_wallet.balance, v_wallet.balance - v_final, 'wallet');

  INSERT INTO public.printer_subscriptions(
    user_id, user_printer_id, plan_id, status, start_date, end_date,
    monthly_price, duration_months, discount_percentage_applied, total_paid,
    next_billing_date, auto_renew
  ) VALUES (
    v_uid, v_printer.id, v_plan.id, 'active', v_now,
    v_now + (v_months || ' months')::interval,
    COALESCE(v_plan.monthly_price,0), v_months, v_disc, v_final,
    v_now + (v_months || ' months')::interval, false
  ) RETURNING id INTO v_sub_id;

  RETURN jsonb_build_object('success',true,'subscription_id',v_sub_id,'total_paid',v_final);
END; $$;

GRANT EXECUTE ON FUNCTION public.subscribe_protection_plan(uuid,uuid,integer,numeric,numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.levo_subscribe_card(uuid,uuid,text,numeric,integer,numeric) TO authenticated;
