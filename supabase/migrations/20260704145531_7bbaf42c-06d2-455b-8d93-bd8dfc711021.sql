
-- ============================================================
-- 1) chat_orders: block buyer-side price spoofing
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_chat_order_price()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_authoritative_unit numeric;
BEGIN
  -- Admins & assistants: unrestricted
  IF v_uid IS NOT NULL AND (
       public.has_role(v_uid, 'admin'::app_role)
    OR public.has_role(v_uid, 'assistant'::app_role)
  ) THEN
    RETURN NEW;
  END IF;

  -- Seller may set negotiated pricing on rows they own
  IF v_uid IS NOT NULL AND v_uid = NEW.seller_id THEN
    RETURN NEW;
  END IF;

  -- Customer path: enforce authoritative product price
  IF NEW.product_id IS NOT NULL THEN
    SELECT price INTO v_authoritative_unit
      FROM public.merchant_products
     WHERE id = NEW.product_id;

    IF v_authoritative_unit IS NOT NULL THEN
      -- Total cannot be below product's authoritative price × quantity
      IF COALESCE(NEW.total_price, 0) < (v_authoritative_unit * GREATEST(NEW.quantity, 1)) THEN
        RAISE EXCEPTION 'chat_order_total_below_authoritative_price (product=%, expected>=%, got=%)',
          NEW.product_id, v_authoritative_unit * GREATEST(NEW.quantity, 1), NEW.total_price
          USING ERRCODE = '42501';
      END IF;
      -- Unit price for single-item orders must match authoritative
      IF NEW.quantity = 1 AND COALESCE(NEW.unit_price, 0) < v_authoritative_unit THEN
        RAISE EXCEPTION 'chat_order_unit_price_below_authoritative_price'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  -- Block price downgrades on update by the customer
  IF TG_OP = 'UPDATE' THEN
    IF COALESCE(NEW.total_price, 0) < COALESCE(OLD.total_price, 0)
       OR COALESCE(NEW.unit_price, 0) < COALESCE(OLD.unit_price, 0) THEN
      RAISE EXCEPTION 'chat_order_price_reduction_forbidden'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_chat_order_price ON public.chat_orders;
CREATE TRIGGER trg_enforce_chat_order_price
BEFORE INSERT OR UPDATE ON public.chat_orders
FOR EACH ROW EXECUTE FUNCTION public.enforce_chat_order_price();


-- ============================================================
-- 2) orders: paid_amount must be backed by real wallet debit
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_order_paid_amount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_wallet_debited numeric;
BEGIN
  IF v_uid IS NULL
     OR public.has_role(v_uid, 'admin'::app_role)
     OR public.has_role(v_uid, 'assistant'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Only enforce when the row owner is the caller (self-service inserts/updates)
  IF v_uid <> NEW.user_id THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.paid_amount, 0) > 0 THEN
      SELECT COALESCE(SUM(amount), 0) INTO v_wallet_debited
        FROM public.wallet_transactions
       WHERE user_id = NEW.user_id
         AND type = 'debit'
         AND (
              idempotency_key = ('direct_sale:' || NEW.order_number)
           OR idempotency_key LIKE ('%' || NEW.order_number || '%')
           OR description  LIKE ('%' || NEW.order_number || '%')
         );

      IF NEW.paid_amount > v_wallet_debited THEN
        RAISE EXCEPTION 'order_paid_amount_exceeds_wallet_debit (paid=%, wallet_debited=%)',
          NEW.paid_amount, v_wallet_debited USING ERRCODE = '42501';
      END IF;
    END IF;

    -- If declaring the order fully paid, paid_amount must actually cover total_amount
    IF NEW.payment_status = 'paid'
       AND COALESCE(NEW.paid_amount, 0) < COALESCE(NEW.total_amount, 0) THEN
      RAISE EXCEPTION 'order_paid_status_requires_full_paid_amount'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Never let the user shrink the recorded total
    IF COALESCE(NEW.total_amount, 0) < COALESCE(OLD.total_amount, 0) THEN
      RAISE EXCEPTION 'order_total_reduction_forbidden'
        USING ERRCODE = '42501';
    END IF;

    -- Increases to paid_amount must be backed by additional wallet debit
    IF COALESCE(NEW.paid_amount, 0) > COALESCE(OLD.paid_amount, 0) THEN
      SELECT COALESCE(SUM(amount), 0) INTO v_wallet_debited
        FROM public.wallet_transactions
       WHERE user_id = NEW.user_id
         AND type = 'debit'
         AND (
              idempotency_key = ('direct_sale:' || NEW.order_number)
           OR idempotency_key LIKE ('%' || NEW.order_number || '%')
           OR description  LIKE ('%' || NEW.order_number || '%')
         );
      IF NEW.paid_amount > v_wallet_debited THEN
        RAISE EXCEPTION 'order_paid_increase_exceeds_wallet_debit'
          USING ERRCODE = '42501';
      END IF;
    END IF;

    -- Flipping to payment_status='paid' requires paid_amount>=total_amount
    IF NEW.payment_status = 'paid'
       AND OLD.payment_status IS DISTINCT FROM NEW.payment_status
       AND COALESCE(NEW.paid_amount, 0) < COALESCE(NEW.total_amount, 0) THEN
      RAISE EXCEPTION 'order_paid_status_requires_full_paid_amount'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_order_paid_amount ON public.orders;
CREATE TRIGGER trg_enforce_order_paid_amount
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.enforce_order_paid_amount();


-- ============================================================
-- 3) merchant_applications: lock verification / fee / status
-- ============================================================
CREATE OR REPLACE FUNCTION public.prevent_merchant_application_self_tamper()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL
     OR public.has_role(v_uid, 'admin'::app_role)
     OR public.has_role(v_uid, 'assistant'::app_role) THEN
    RETURN NEW;
  END IF;

  IF v_uid = OLD.user_id THEN
    IF NEW.is_verified        IS DISTINCT FROM OLD.is_verified
       OR NEW.badge_tier      IS DISTINCT FROM OLD.badge_tier
       OR NEW.badge_override  IS DISTINCT FROM OLD.badge_override
       OR NEW.fee_status      IS DISTINCT FROM OLD.fee_status
       OR NEW.fee_transaction_id IS DISTINCT FROM OLD.fee_transaction_id
       OR NEW.registration_fee IS DISTINCT FROM OLD.registration_fee
       OR NEW.status          IS DISTINCT FROM OLD.status
       OR NEW.user_id         IS DISTINCT FROM OLD.user_id
       OR NEW.rejected_at     IS DISTINCT FROM OLD.rejected_at
       OR NEW.admin_notes     IS DISTINCT FROM OLD.admin_notes THEN
      RAISE EXCEPTION 'merchant_application_protected_fields_immutable'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_merchant_app_self_tamper ON public.merchant_applications;
CREATE TRIGGER trg_prevent_merchant_app_self_tamper
BEFORE UPDATE ON public.merchant_applications
FOR EACH ROW EXECUTE FUNCTION public.prevent_merchant_application_self_tamper();


-- ============================================================
-- 4) merchant_public_profiles: extend existing tamper guard
-- ============================================================
CREATE OR REPLACE FUNCTION public.prevent_merchant_profile_tampering()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
  v_uid uuid := auth.uid();
BEGIN
  SELECT user_id INTO v_owner_id
    FROM public.merchant_applications
   WHERE id = NEW.id;

  IF v_uid IS DISTINCT FROM v_owner_id
     AND NOT public.has_role(v_uid, 'admin'::app_role)
     AND NOT public.has_role(v_uid, 'assistant'::app_role) THEN
    RAISE EXCEPTION 'غير مصرح لك بتعديل هذا الملف' USING ERRCODE = '42501';
  END IF;

  IF NOT public.has_role(v_uid, 'admin'::app_role)
     AND NOT public.has_role(v_uid, 'assistant'::app_role) THEN
    IF NEW.is_verified          IS DISTINCT FROM OLD.is_verified
       OR NEW.badge_tier        IS DISTINCT FROM OLD.badge_tier
       OR NEW.selected_frame_id IS DISTINCT FROM OLD.selected_frame_id
       OR NEW.total_debt        IS DISTINCT FROM OLD.total_debt
       OR NEW.debt_suspended    IS DISTINCT FROM OLD.debt_suspended
       OR NEW.debt_suspended_at IS DISTINCT FROM OLD.debt_suspended_at
       OR NEW.store_slug        IS DISTINCT FROM OLD.store_slug THEN
      RAISE EXCEPTION 'merchant_public_profile_protected_fields_immutable'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


-- ============================================================
-- 5) printer_subscriptions: force pending/zero on self-insert
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_printer_subscription_self_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL
     OR public.has_role(v_uid, 'admin'::app_role)
     OR public.has_role(v_uid, 'assistant'::app_role) THEN
    RETURN NEW;
  END IF;

  IF v_uid <> NEW.user_id THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Force self-inserted subscriptions to pending, zero price/duration.
    -- Admins must approve + set real values after payment verification.
    NEW.status            := 'pending'::printer_subscription_status;
    NEW.monthly_price     := 0;
    NEW.end_date          := NULL;
    NEW.next_billing_date := NULL;
    NEW.auto_renew        := false;
    NEW.waiting_period_ends_at := NULL;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.status         IS DISTINCT FROM OLD.status
       OR NEW.monthly_price  IS DISTINCT FROM OLD.monthly_price
       OR NEW.end_date       IS DISTINCT FROM OLD.end_date
       OR NEW.next_billing_date IS DISTINCT FROM OLD.next_billing_date
       OR NEW.plan_id        IS DISTINCT FROM OLD.plan_id
       OR NEW.waiting_period_ends_at IS DISTINCT FROM OLD.waiting_period_ends_at
       OR NEW.used_days      IS DISTINCT FROM OLD.used_days
       OR NEW.remaining_days IS DISTINCT FROM OLD.remaining_days
       OR NEW.refund_amount  IS DISTINCT FROM OLD.refund_amount THEN
      RAISE EXCEPTION 'printer_subscription_protected_fields_immutable'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_printer_subscription_self_insert ON public.printer_subscriptions;
CREATE TRIGGER trg_enforce_printer_subscription_self_insert
BEFORE INSERT OR UPDATE ON public.printer_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.enforce_printer_subscription_self_insert();


-- ============================================================
-- 6) user_cards: block self-extension / self-activation / self-payment change
-- ============================================================
CREATE OR REPLACE FUNCTION public.prevent_user_card_self_tamper()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL
     OR public.has_role(v_uid, 'admin'::app_role)
     OR public.has_role(v_uid, 'assistant'::app_role) THEN
    RETURN NEW;
  END IF;

  IF v_uid = OLD.user_id THEN
    IF NEW.is_active            IS DISTINCT FROM OLD.is_active
       OR NEW.expires_at        IS DISTINCT FROM OLD.expires_at
       OR NEW.points_spent      IS DISTINCT FROM OLD.points_spent
       OR NEW.payment_method    IS DISTINCT FROM OLD.payment_method
       OR NEW.wallet_amount_paid IS DISTINCT FROM OLD.wallet_amount_paid
       OR NEW.card_id           IS DISTINCT FROM OLD.card_id
       OR NEW.user_id           IS DISTINCT FROM OLD.user_id
       OR NEW.purchased_at      IS DISTINCT FROM OLD.purchased_at THEN
      RAISE EXCEPTION 'user_card_protected_fields_immutable'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_user_card_self_tamper ON public.user_cards;
CREATE TRIGGER trg_prevent_user_card_self_tamper
BEFORE UPDATE ON public.user_cards
FOR EACH ROW EXECUTE FUNCTION public.prevent_user_card_self_tamper();


-- ============================================================
-- 7) product_bookings: block buyer from flipping status / deposit_paid
-- ============================================================
CREATE OR REPLACE FUNCTION public.prevent_product_booking_self_tamper()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL
     OR public.has_role(v_uid, 'admin'::app_role)
     OR public.has_role(v_uid, 'assistant'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Merchant can update via the "Merchants can update product bookings" policy
  IF EXISTS (
    SELECT 1 FROM public.merchant_applications ma
     WHERE ma.user_id = v_uid
       AND ma.id = OLD.merchant_id
       AND ma.status = 'approved'
  ) THEN
    RETURN NEW;
  END IF;

  IF v_uid = OLD.user_id THEN
    IF NEW.status          IS DISTINCT FROM OLD.status
       OR NEW.deposit_paid IS DISTINCT FROM OLD.deposit_paid
       OR NEW.deposit_amount IS DISTINCT FROM OLD.deposit_amount
       OR NEW.queue_position IS DISTINCT FROM OLD.queue_position
       OR NEW.booking_type IS DISTINCT FROM OLD.booking_type
       OR NEW.product_id   IS DISTINCT FROM OLD.product_id
       OR NEW.merchant_id  IS DISTINCT FROM OLD.merchant_id
       OR NEW.user_id      IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'product_booking_protected_fields_immutable'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_product_booking_self_tamper ON public.product_bookings;
CREATE TRIGGER trg_prevent_product_booking_self_tamper
BEFORE UPDATE ON public.product_bookings
FOR EACH ROW EXECUTE FUNCTION public.prevent_product_booking_self_tamper();
