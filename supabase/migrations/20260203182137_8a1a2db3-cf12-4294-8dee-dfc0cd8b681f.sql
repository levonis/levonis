-- Create secure RPC function for order payments from wallet
CREATE OR REPLACE FUNCTION pay_order_from_wallet(
  p_user_id UUID,
  p_order_id UUID,
  p_order_number TEXT,
  p_amount NUMERIC
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance NUMERIC;
  v_transaction_id UUID;
BEGIN
  -- Verify the caller is the owner
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'غير مصرح: لا يمكنك الدفع من محفظة مستخدم آخر';
  END IF;
  
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'المبلغ يجب أن يكون أكبر من صفر';
  END IF;

  -- Lock the row and get current balance
  SELECT balance INTO v_current_balance
  FROM user_wallets
  WHERE user_id = p_user_id
  FOR UPDATE;
  
  IF v_current_balance IS NULL THEN
    RAISE EXCEPTION 'محفظة المستخدم غير موجودة';
  END IF;
  
  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'رصيد المحفظة غير كافٍ. الرصيد الحالي: % | المطلوب: %', v_current_balance, p_amount;
  END IF;
  
  -- Perform atomic update
  UPDATE user_wallets
  SET balance = balance - p_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id;
  
  -- Create transaction record with order_payment type
  INSERT INTO wallet_transactions (user_id, type, amount, status, admin_notes)
  VALUES (p_user_id, 'order_payment', -p_amount, 'completed', 'دفع طلب رقم ' || p_order_number)
  RETURNING id INTO v_transaction_id;

  -- Update order payment status
  UPDATE orders
  SET customer_paid_amount = p_amount,
      payment_status = 'paid',
      updated_at = NOW()
  WHERE id = p_order_id AND user_id = p_user_id;
  
  RETURN v_transaction_id;
END;
$$;