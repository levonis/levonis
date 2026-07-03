
-- =============================================
-- Levo Physical Card ORDERS (approval workflow)
-- =============================================

CREATE TABLE IF NOT EXISTS public.levo_card_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN ('pending_payment','paid_pending_approval','approved','rejected','cancelled')),
  full_name_triple text NOT NULL,
  birth_date date NOT NULL,
  email text NOT NULL,
  assigned_card_id uuid REFERENCES public.levo_physical_cards(id) ON DELETE SET NULL,
  admin_notes text,
  rejection_reason text,
  approved_at timestamptz,
  approved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_levo_orders_user ON public.levo_card_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_levo_orders_status ON public.levo_card_orders(status);
CREATE INDEX IF NOT EXISTS idx_levo_orders_order ON public.levo_card_orders(order_id);
-- Only one "in-flight" (non-terminal) request per user at a time
CREATE UNIQUE INDEX IF NOT EXISTS ux_levo_orders_user_open
  ON public.levo_card_orders(user_id)
  WHERE status IN ('pending_payment','paid_pending_approval');

GRANT SELECT, INSERT, UPDATE ON public.levo_card_orders TO authenticated;
GRANT ALL ON public.levo_card_orders TO service_role;

ALTER TABLE public.levo_card_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own levo orders" ON public.levo_card_orders
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Users insert own levo orders" ON public.levo_card_orders
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins manage levo orders" ON public.levo_card_orders
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_levo_orders_updated
  BEFORE UPDATE ON public.levo_card_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- Submit request (called BEFORE checkout, stores form data)
-- =============================================
CREATE OR REPLACE FUNCTION public.submit_levo_card_request(
  p_full_name text,
  p_birth_date date,
  p_email text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error','unauthenticated');
  END IF;

  -- Validation
  IF coalesce(trim(p_full_name),'') = '' OR length(trim(p_full_name)) < 6 THEN
    RETURN jsonb_build_object('success', false, 'error','invalid_name');
  END IF;
  IF p_birth_date IS NULL OR p_birth_date > (current_date - interval '10 years')::date THEN
    RETURN jsonb_build_object('success', false, 'error','invalid_birth_date');
  END IF;
  IF coalesce(trim(p_email),'') = '' OR position('@' in p_email) < 2 THEN
    RETURN jsonb_build_object('success', false, 'error','invalid_email');
  END IF;

  -- Reject if user already has an active levo card
  IF EXISTS(SELECT 1 FROM public.levo_card_assignments WHERE user_id = v_uid AND released_at IS NULL) THEN
    RETURN jsonb_build_object('success', false, 'error','user_has_card');
  END IF;

  -- Upsert into the open row (unique on user when status in open states)
  INSERT INTO public.levo_card_orders(user_id, full_name_triple, birth_date, email, status)
  VALUES (v_uid, trim(p_full_name), p_birth_date, lower(trim(p_email)), 'pending_payment')
  ON CONFLICT (user_id) WHERE status IN ('pending_payment','paid_pending_approval') DO UPDATE
    SET full_name_triple = EXCLUDED.full_name_triple,
        birth_date = EXCLUDED.birth_date,
        email = EXCLUDED.email,
        updated_at = now()
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'id', v_id);
END; $$;

GRANT EXECUTE ON FUNCTION public.submit_levo_card_request(text, date, text) TO authenticated;

-- =============================================
-- Trigger on orders: auto-link levo_card_orders when order contains levo card
-- =============================================
CREATE OR REPLACE FUNCTION public.link_levo_card_order_after_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_card_pid uuid := public.get_levo_card_product_id();
  v_has_card boolean;
BEGIN
  IF v_card_pid IS NULL THEN RETURN NEW; END IF;
  SELECT EXISTS(
    SELECT 1 FROM public.order_items WHERE order_id = NEW.id AND product_id = v_card_pid
  ) INTO v_has_card;
  IF NOT v_has_card THEN RETURN NEW; END IF;

  UPDATE public.levo_card_orders
     SET status = 'paid_pending_approval',
         order_id = NEW.id,
         updated_at = now()
   WHERE user_id = NEW.user_id
     AND status = 'pending_payment';

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_link_levo_card_order ON public.orders;
CREATE TRIGGER trg_link_levo_card_order
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.link_levo_card_order_after_order();

-- Also fire when items are inserted (some flows insert items after order)
CREATE OR REPLACE FUNCTION public.link_levo_card_order_after_item()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_card_pid uuid := public.get_levo_card_product_id();
  v_user uuid;
BEGIN
  IF v_card_pid IS NULL OR NEW.product_id IS NULL OR NEW.product_id <> v_card_pid THEN
    RETURN NEW;
  END IF;
  SELECT user_id INTO v_user FROM public.orders WHERE id = NEW.order_id;
  IF v_user IS NULL THEN RETURN NEW; END IF;

  UPDATE public.levo_card_orders
     SET status = 'paid_pending_approval',
         order_id = NEW.order_id,
         updated_at = now()
   WHERE user_id = v_user
     AND status = 'pending_payment';
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_link_levo_card_order_item ON public.order_items;
CREATE TRIGGER trg_link_levo_card_order_item
  AFTER INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.link_levo_card_order_after_item();

-- =============================================
-- Admin approve: assign first available card and return its full secrets (for email)
-- =============================================
CREATE OR REPLACE FUNCTION public.approve_levo_card_order(
  p_request_id uuid,
  p_admin_notes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_req public.levo_card_orders%ROWTYPE;
  v_card public.levo_physical_cards%ROWTYPE;
  v_assignment_id uuid;
BEGIN
  IF NOT public.has_role(v_uid,'admin') THEN
    RETURN jsonb_build_object('success', false, 'error','forbidden');
  END IF;

  SELECT * INTO v_req FROM public.levo_card_orders WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error','not_found'); END IF;
  IF v_req.status NOT IN ('paid_pending_approval','pending_payment') THEN
    RETURN jsonb_build_object('success', false, 'error','invalid_status', 'status', v_req.status);
  END IF;

  -- Reject if user already has an assignment
  IF EXISTS(SELECT 1 FROM public.levo_card_assignments WHERE user_id = v_req.user_id AND released_at IS NULL) THEN
    RETURN jsonb_build_object('success', false, 'error','user_already_has_card');
  END IF;

  -- Lock first available card
  SELECT * INTO v_card FROM public.levo_physical_cards
   WHERE status = 'unassigned'
   ORDER BY created_at ASC
   FOR UPDATE SKIP LOCKED
   LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error','no_cards_available');
  END IF;

  INSERT INTO public.levo_card_assignments(card_id, user_id) VALUES (v_card.id, v_req.user_id)
    RETURNING id INTO v_assignment_id;
  UPDATE public.levo_physical_cards SET status='assigned', updated_at=now() WHERE id = v_card.id;

  UPDATE public.levo_card_orders
     SET status='approved',
         assigned_card_id = v_card.id,
         admin_notes = coalesce(p_admin_notes, admin_notes),
         approved_at = now(),
         approved_by = v_uid,
         updated_at = now()
   WHERE id = v_req.id;

  RETURN jsonb_build_object(
    'success', true,
    'request_id', v_req.id,
    'user_id', v_req.user_id,
    'email', v_req.email,
    'full_name', v_req.full_name_triple,
    'assignment_id', v_assignment_id,
    'card', jsonb_build_object(
      'id', v_card.id,
      'card_number', v_card.card_number,
      'pin', v_card.pin_plaintext,
      'qr_token', v_card.qr_token,
      'nfc_token', v_card.nfc_token
    )
  );
END; $$;
GRANT EXECUTE ON FUNCTION public.approve_levo_card_order(uuid, text) TO authenticated;

-- =============================================
-- Admin reject
-- =============================================
CREATE OR REPLACE FUNCTION public.reject_levo_card_order(
  p_request_id uuid,
  p_reason text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF NOT public.has_role(v_uid,'admin') THEN
    RETURN jsonb_build_object('success', false, 'error','forbidden');
  END IF;
  IF coalesce(trim(p_reason),'') = '' THEN
    RETURN jsonb_build_object('success', false, 'error','reason_required');
  END IF;
  UPDATE public.levo_card_orders
     SET status='rejected',
         rejection_reason = p_reason,
         approved_by = v_uid,
         approved_at = now(),
         updated_at = now()
   WHERE id = p_request_id
     AND status IN ('paid_pending_approval','pending_payment');
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error','not_found_or_invalid_status');
  END IF;
  RETURN jsonb_build_object('success', true);
END; $$;
GRANT EXECUTE ON FUNCTION public.reject_levo_card_order(uuid, text) TO authenticated;

-- =============================================
-- User cancel own pending request (e.g. after rejection to retry)
-- =============================================
CREATE OR REPLACE FUNCTION public.cancel_levo_card_request(p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('success', false, 'error','unauthenticated'); END IF;
  UPDATE public.levo_card_orders
     SET status='cancelled', updated_at = now()
   WHERE id = p_request_id AND user_id = v_uid AND status = 'pending_payment';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error','not_cancellable');
  END IF;
  RETURN jsonb_build_object('success', true);
END; $$;
GRANT EXECUTE ON FUNCTION public.cancel_levo_card_request(uuid) TO authenticated;
