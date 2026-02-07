-- Fix admin_adjust_wallet to NOT create duplicate transaction records when approving deposits
-- Instead, just update the balance

-- Create a new function specifically for approving pending transactions
CREATE OR REPLACE FUNCTION public.admin_approve_transaction(
  p_transaction_id UUID
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transaction RECORD;
  v_lock_key BIGINT;
BEGIN
  -- Only admins can call this
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  -- Get and lock the transaction
  SELECT * INTO v_transaction
  FROM wallet_transactions
  WHERE id = p_transaction_id
  FOR UPDATE;

  IF v_transaction IS NULL THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;

  IF v_transaction.status != 'pending' THEN
    RAISE EXCEPTION 'Transaction is not pending, current status: %', v_transaction.status;
  END IF;

  -- Get advisory lock per user to prevent race conditions
  v_lock_key := ('x' || left(md5(v_transaction.user_id::text), 15))::bit(60)::bigint;
  IF NOT pg_try_advisory_xact_lock(v_lock_key) THEN
    RAISE EXCEPTION 'Another transaction is in progress for this user. Please try again.';
  END IF;

  -- Handle deposit: add to balance
  IF v_transaction.type = 'deposit' THEN
    -- Upsert wallet with the deposit amount
    INSERT INTO user_wallets (user_id, balance)
    VALUES (v_transaction.user_id, v_transaction.amount)
    ON CONFLICT (user_id)
    DO UPDATE SET 
      balance = user_wallets.balance + v_transaction.amount,
      updated_at = NOW();
  
  -- Handle withdrawal: deduct from balance (verify sufficient funds)
  ELSIF v_transaction.type = 'withdrawal' THEN
    UPDATE user_wallets
    SET balance = GREATEST(0, balance - v_transaction.amount),
        updated_at = NOW()
    WHERE user_id = v_transaction.user_id
      AND balance >= v_transaction.amount;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Insufficient balance for withdrawal';
    END IF;
  END IF;

  -- Update transaction status to completed
  UPDATE wallet_transactions
  SET status = 'completed',
      admin_notes = COALESCE(admin_notes, '') || ' | تمت الموافقة',
      updated_at = NOW()
  WHERE id = p_transaction_id;

  RETURN true;
END;
$$;

-- Create atomic function for checkout that creates order AND deducts wallet in one transaction
CREATE OR REPLACE FUNCTION public.create_order_with_wallet_payment(
  p_user_id UUID,
  p_order_data JSONB,
  p_payment_amount NUMERIC
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance NUMERIC;
  v_order_id UUID;
  v_order_number TEXT;
  v_transaction_id UUID;
  v_lock_key BIGINT;
BEGIN
  -- Verify the caller is the owner
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'غير مصرح: لا يمكنك إنشاء طلب لمستخدم آخر';
  END IF;
  
  IF p_payment_amount <= 0 THEN
    RAISE EXCEPTION 'المبلغ يجب أن يكون أكبر من صفر';
  END IF;

  -- Get advisory lock per user to prevent race conditions
  v_lock_key := ('x' || left(md5(p_user_id::text), 15))::bit(60)::bigint;
  IF NOT pg_try_advisory_xact_lock(v_lock_key) THEN
    RAISE EXCEPTION 'عملية أخرى قيد التنفيذ. حاول مجدداً.';
  END IF;

  -- Lock the row and get current balance
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

  -- Generate order number
  SELECT generate_order_number() INTO v_order_number;

  -- Create the order first
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
    COALESCE((p_order_data->>'remaining_amount')::NUMERIC, 0),
    CASE WHEN COALESCE((p_order_data->>'remaining_amount')::NUMERIC, 0) > 0 THEN 'partial' ELSE 'paid' END,
    'pending',
    'دينار عراقي',
    p_order_data->>'shipping_address',
    p_order_data->>'phone_number',
    p_order_data->>'governorate',
    p_payment_amount
  )
  RETURNING id INTO v_order_id;

  -- Deduct from wallet
  UPDATE user_wallets
  SET balance = balance - p_payment_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id;
  
  -- Create wallet transaction record
  INSERT INTO wallet_transactions (user_id, type, amount, status, admin_notes)
  VALUES (p_user_id, 'order_payment', -p_payment_amount, 'completed', 'دفع طلب رقم ' || v_order_number)
  RETURNING id INTO v_transaction_id;

  RETURN v_order_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.admin_approve_transaction(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_order_with_wallet_payment(UUID, JSONB, NUMERIC) TO authenticated;