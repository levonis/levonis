
-- 1) Relax the enforce_order_paid_amount trigger: allow trusted SECURITY DEFINER RPCs
--    (which perform their own auth.uid() check) to bypass, while still blocking any
--    direct client-side INSERT/UPDATE that fabricates paid_amount.
CREATE OR REPLACE FUNCTION public.enforce_order_paid_amount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_wallet_debited numeric;
  v_trusted text;
BEGIN
  -- Trusted server-side RPCs opt-in via a transaction-local GUC.
  v_trusted := current_setting('app.trusted_order_write', true);
  IF v_trusted = '1' THEN
    RETURN NEW;
  END IF;

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

    IF NEW.payment_status = 'paid'
       AND COALESCE(NEW.paid_amount, 0) < COALESCE(NEW.total_amount, 0) THEN
      RAISE EXCEPTION 'order_paid_status_requires_full_paid_amount'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF COALESCE(NEW.total_amount, 0) < COALESCE(OLD.total_amount, 0) THEN
      RAISE EXCEPTION 'order_total_reduction_forbidden'
        USING ERRCODE = '42501';
    END IF;

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


-- 2) Have the wallet-payment RPC opt-in as trusted at the start of its transaction.
CREATE OR REPLACE FUNCTION public.create_order_with_wallet_payment(p_user_id uuid, p_order_data jsonb, p_payment_amount numeric)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_current_balance NUMERIC;
  v_order_id UUID;
  v_order_number TEXT;
  v_transaction_id UUID;
  v_lock_key BIGINT;
  v_remaining NUMERIC;
  v_payment_status TEXT;
  v_requested_payment_status TEXT;
  v_payment_method TEXT;
BEGIN
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'غير مصرح: لا يمكنك إنشاء طلب لمستخدم آخر';
  END IF;

  IF p_payment_amount < 0 THEN
    RAISE EXCEPTION 'المبلغ لا يمكن أن يكون سالباً';
  END IF;

  -- Mark this transaction as a trusted server-side order write so the
  -- enforce_order_paid_amount trigger allows the insert (we debit the
  -- wallet in the same transaction, immediately after the insert).
  PERFORM set_config('app.trusted_order_write', '1', true);

  v_lock_key := ('x' || left(md5(p_user_id::text), 15))::bit(60)::bigint;
  IF NOT pg_try_advisory_xact_lock(v_lock_key) THEN
    RAISE EXCEPTION 'عملية أخرى قيد التنفيذ. حاول مجدداً.';
  END IF;

  IF p_payment_amount > 0 THEN
    SELECT balance INTO v_current_balance
    FROM public.user_wallets
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF v_current_balance IS NULL THEN
      RAISE EXCEPTION 'محفظة المستخدم غير موجودة';
    END IF;

    IF v_current_balance < p_payment_amount THEN
      RAISE EXCEPTION 'رصيد المحفظة غير كافٍ. الرصيد الحالي: % | المطلوب: %', v_current_balance, p_payment_amount;
    END IF;
  END IF;

  SELECT public.generate_order_number() INTO v_order_number;

  v_remaining := COALESCE((p_order_data->>'remaining_amount')::NUMERIC, 0);
  v_payment_method := COALESCE(NULLIF(p_order_data->>'payment_method', ''), CASE WHEN p_payment_amount > 0 THEN 'wallet' ELSE 'cod' END);
  v_requested_payment_status := NULLIF(p_order_data->>'payment_status', '');

  IF v_requested_payment_status IN ('cod', 'partial', 'paid', 'pending') THEN
    v_payment_status := v_requested_payment_status;
  ELSIF v_payment_method = 'cod' THEN
    v_payment_status := 'cod';
  ELSIF v_remaining <= 0 THEN
    v_payment_status := 'paid';
  ELSIF p_payment_amount > 0 THEN
    v_payment_status := 'partial';
  ELSE
    v_payment_status := 'cod';
  END IF;

  INSERT INTO public.orders (
    user_id,
    order_number,
    total_amount,
    subtotal,
    paid_amount,
    remaining_amount,
    cod_fee,
    payment_status,
    payment_method,
    status,
    currency,
    shipping_address,
    phone_number,
    governorate,
    customer_paid_amount,
    delivery_method,
    discount_amount,
    card_discount_amount,
    card_discount_level_name,
    referral_coupon_id,
    referral_owner_earnings_iqd
  ) VALUES (
    p_user_id,
    v_order_number,
    (p_order_data->>'total_amount')::NUMERIC,
    (p_order_data->>'subtotal')::NUMERIC,
    COALESCE((p_order_data->>'paid_amount')::NUMERIC, 0),
    v_remaining,
    GREATEST(0, COALESCE((p_order_data->>'cod_fee')::NUMERIC, 0)),
    v_payment_status,
    v_payment_method,
    'pending',
    'دينار عراقي',
    p_order_data->>'shipping_address',
    p_order_data->>'phone_number',
    p_order_data->>'governorate',
    p_payment_amount,
    COALESCE(NULLIF(p_order_data->>'delivery_method', ''), 'standard'),
    COALESCE((p_order_data->>'discount_amount')::NUMERIC, 0),
    COALESCE((p_order_data->>'card_discount_amount')::NUMERIC, 0),
    NULLIF(p_order_data->>'card_discount_level_name', ''),
    NULLIF(p_order_data->>'referral_coupon_id', '')::UUID,
    COALESCE((p_order_data->>'referral_owner_earnings_iqd')::NUMERIC, 0)
  )
  RETURNING id INTO v_order_id;

  IF p_payment_amount > 0 THEN
    UPDATE public.user_wallets
    SET balance = balance - p_payment_amount,
        updated_at = NOW()
    WHERE user_id = p_user_id;

    INSERT INTO public.wallet_transactions (user_id, type, amount, status, admin_notes, description, idempotency_key, order_id)
    VALUES (
      p_user_id, 'debit', p_payment_amount, 'completed',
      'دفع طلب رقم ' || v_order_number,
      'دفع طلب رقم ' || v_order_number,
      'order_payment:' || v_order_number,
      v_order_id
    )
    RETURNING id INTO v_transaction_id;
  END IF;

  RETURN v_order_id;
END;
$function$;


-- 3) Also flag pay_order_from_wallet as trusted when it updates paid_amount
--    (only if the function exists in this project).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='pay_order_from_wallet'
  ) THEN
    EXECUTE $body$
      CREATE OR REPLACE FUNCTION public.pay_order_from_wallet(p_order_id uuid, p_amount numeric)
      RETURNS void
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path TO 'public'
      AS $inner$
      DECLARE
        v_uid uuid := auth.uid();
        v_order public.orders%ROWTYPE;
        v_balance numeric;
      BEGIN
        PERFORM set_config('app.trusted_order_write', '1', true);
        SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
        IF v_order.id IS NULL THEN RAISE EXCEPTION 'order_not_found'; END IF;
        IF v_uid IS NULL OR v_uid <> v_order.user_id THEN RAISE EXCEPTION 'unauthorized'; END IF;
        IF p_amount <= 0 THEN RAISE EXCEPTION 'invalid_amount'; END IF;

        SELECT balance INTO v_balance FROM public.user_wallets WHERE user_id = v_uid FOR UPDATE;
        IF v_balance IS NULL OR v_balance < p_amount THEN RAISE EXCEPTION 'insufficient_balance'; END IF;

        UPDATE public.user_wallets SET balance = balance - p_amount, updated_at = now() WHERE user_id = v_uid;
        INSERT INTO public.wallet_transactions (user_id, type, amount, status, description, idempotency_key, order_id)
        VALUES (v_uid, 'debit', p_amount, 'completed',
          'دفع طلب رقم ' || v_order.order_number,
          'order_payment_top:' || v_order.order_number || ':' || extract(epoch from now())::text,
          v_order.id);

        UPDATE public.orders
           SET paid_amount = COALESCE(paid_amount,0) + p_amount,
               remaining_amount = GREATEST(0, COALESCE(remaining_amount,0) - p_amount),
               payment_status = CASE
                  WHEN COALESCE(paid_amount,0) + p_amount >= COALESCE(total_amount,0) THEN 'paid'
                  ELSE 'partial' END,
               updated_at = now()
         WHERE id = p_order_id;
      END;
      $inner$;
    $body$;
  END IF;
END $$;
