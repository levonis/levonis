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
BEGIN
  -- Verify the caller is the owner
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'غير مصرح: لا يمكنك إنشاء طلب لمستخدم آخر';
  END IF;

  IF p_payment_amount < 0 THEN
    RAISE EXCEPTION 'المبلغ لا يمكن أن يكون سالباً';
  END IF;

  -- Get advisory lock per user to prevent race conditions
  v_lock_key := ('x' || left(md5(p_user_id::text), 15))::bit(60)::bigint;
  IF NOT pg_try_advisory_xact_lock(v_lock_key) THEN
    RAISE EXCEPTION 'عملية أخرى قيد التنفيذ. حاول مجدداً.';
  END IF;

  -- Wallet check ONLY when there's an actual wallet payment
  IF p_payment_amount > 0 THEN
    SELECT balance INTO v_current_balance
    FROM user_wallets
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF v_current_balance IS NULL THEN
      RAISE EXCEPTION 'محفظة المستخدم غير موجودة';
    END IF;

    IF v_current_balance < p_payment_amount THEN
      RAISE EXCEPTION 'رصيد المحفظة غير كافٍ. الرصيد الحالي: % | المطلوب: %', v_current_balance, p_payment_amount;
    END IF;
  END IF;

  -- Generate order number
  SELECT generate_order_number() INTO v_order_number;

  v_remaining := COALESCE((p_order_data->>'remaining_amount')::NUMERIC, 0);
  -- payment_status: paid if no remaining, partial if some paid + remaining, cod if nothing paid yet
  IF v_remaining <= 0 THEN
    v_payment_status := 'paid';
  ELSIF p_payment_amount > 0 THEN
    v_payment_status := 'partial';
  ELSE
    v_payment_status := 'cod';
  END IF;

  -- Create the order
  INSERT INTO orders (
    user_id,
    order_number,
    total_amount,
    subtotal,
    paid_amount,
    remaining_amount,
    payment_status,
    status,
    currency,
    shipping_address,
    phone_number,
    governorate,
    customer_paid_amount
  ) VALUES (
    p_user_id,
    v_order_number,
    (p_order_data->>'total_amount')::NUMERIC,
    (p_order_data->>'subtotal')::NUMERIC,
    (p_order_data->>'paid_amount')::NUMERIC,
    v_remaining,
    v_payment_status,
    'pending',
    'دينار عراقي',
    p_order_data->>'shipping_address',
    p_order_data->>'phone_number',
    p_order_data->>'governorate',
    p_payment_amount
  )
  RETURNING id INTO v_order_id;

  -- Deduct from wallet only when there's an actual payment
  IF p_payment_amount > 0 THEN
    UPDATE user_wallets
    SET balance = balance - p_payment_amount,
        updated_at = NOW()
    WHERE user_id = p_user_id;

    INSERT INTO wallet_transactions (user_id, type, amount, status, admin_notes)
    VALUES (p_user_id, 'order_payment', -p_payment_amount, 'completed', 'دفع طلب رقم ' || v_order_number)
    RETURNING id INTO v_transaction_id;
  END IF;

  RETURN v_order_id;
END;
$function$;