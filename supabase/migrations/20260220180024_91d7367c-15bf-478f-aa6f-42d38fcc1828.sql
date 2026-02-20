
DROP FUNCTION IF EXISTS public.deduct_wallet_balance(UUID, NUMERIC, TEXT);

CREATE OR REPLACE FUNCTION public.deduct_wallet_balance(p_user_id UUID, p_amount NUMERIC, p_description TEXT DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance NUMERIC;
  v_transaction_id UUID;
BEGIN
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: Cannot deduct from other users wallet';
  END IF;
  
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid amount: Must be positive';
  END IF;

  SELECT balance INTO v_current_balance
  FROM user_wallets
  WHERE user_id = p_user_id
  FOR UPDATE;
  
  IF v_current_balance IS NULL THEN
    INSERT INTO user_wallets (user_id, balance) VALUES (p_user_id, 0);
    RAISE EXCEPTION 'Insufficient wallet balance';
  END IF;
  
  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient wallet balance';
  END IF;
  
  UPDATE user_wallets
  SET balance = balance - p_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id;
  
  INSERT INTO wallet_transactions (user_id, type, amount, status, admin_notes)
  VALUES (p_user_id, 'withdrawal', p_amount, 'completed', p_description)
  RETURNING id INTO v_transaction_id;
  
  RETURN v_transaction_id;
END;
$$;
