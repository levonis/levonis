CREATE OR REPLACE FUNCTION public.donate_from_wallet(p_amount numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_balance numeric;
  v_name text;
  v_log_id uuid;
  v_new_balance numeric;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT';
  END IF;

  SELECT balance INTO v_balance
    FROM public.user_wallets
    WHERE user_id = v_user
    FOR UPDATE;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'NO_WALLET';
  END IF;
  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE';
  END IF;

  v_new_balance := v_balance - p_amount;

  UPDATE public.user_wallets
    SET balance = v_new_balance,
        updated_at = now()
    WHERE user_id = v_user;

  INSERT INTO public.wallet_transactions
    (user_id, amount, type, status, description, balance_before, balance_after)
  VALUES
    (v_user, -p_amount, 'donation', 'completed', 'تبرع لمؤسسة العين/ودور الأيتام', v_balance, v_new_balance);

  SELECT COALESCE(full_name, username) INTO v_name
    FROM public.profiles WHERE id = v_user;

  INSERT INTO public.donations_log (user_id, display_name, amount, source)
  VALUES (v_user, v_name, p_amount, 'wallet_direct')
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$function$;