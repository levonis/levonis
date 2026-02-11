
-- Create secure RPC for purchasing printer insurance subscription
CREATE OR REPLACE FUNCTION public.purchase_printer_subscription(
  p_printer_id UUID,
  p_plan_id UUID,
  p_price NUMERIC,
  p_is_upgrade BOOLEAN DEFAULT FALSE,
  p_current_sub_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_balance NUMERIC;
  v_start_date TIMESTAMPTZ;
  v_end_date TIMESTAMPTZ;
  v_new_sub_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'يجب تسجيل الدخول';
  END IF;

  -- Lock user wallet row
  PERFORM pg_advisory_xact_lock(hashtext('wallet_' || v_user_id::text));

  -- Check balance
  SELECT balance INTO v_balance
  FROM user_wallets
  WHERE user_id = v_user_id
  FOR UPDATE;

  IF v_balance IS NULL OR v_balance < p_price THEN
    RAISE EXCEPTION 'رصيد المحفظة غير كافٍ. تحتاج % د.ع', p_price;
  END IF;

  -- Deduct balance
  UPDATE user_wallets SET balance = balance - p_price WHERE user_id = v_user_id;

  -- Record transaction
  INSERT INTO wallet_transactions (user_id, amount, type, status, admin_notes)
  VALUES (v_user_id, -p_price, 'purchase', 'completed',
    CASE WHEN p_is_upgrade THEN 'ترقية اشتراك حماية الطابعة' ELSE 'اشتراك حماية الطابعة' END);

  -- Cancel old subscription if upgrading
  IF p_is_upgrade AND p_current_sub_id IS NOT NULL THEN
    UPDATE printer_subscriptions
    SET status = 'cancelled', cancelled_at = NOW()
    WHERE id = p_current_sub_id AND user_id = v_user_id;
  END IF;

  -- Create new subscription
  v_start_date := NOW();
  v_end_date := NOW() + INTERVAL '1 month';

  INSERT INTO printer_subscriptions (user_id, user_printer_id, plan_id, monthly_price, start_date, end_date, status)
  VALUES (v_user_id, p_printer_id, p_plan_id, p_price, v_start_date, v_end_date, 'active')
  RETURNING id INTO v_new_sub_id;

  RETURN jsonb_build_object('success', true, 'subscription_id', v_new_sub_id);
END;
$$;
