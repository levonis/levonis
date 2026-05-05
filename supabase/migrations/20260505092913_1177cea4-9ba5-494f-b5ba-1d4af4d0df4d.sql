ALTER TABLE public.wallet_transactions
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS ux_wallet_tx_user_idem
  ON public.wallet_transactions (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Drop legacy 3-arg signature so we can re-create with a 4th optional parameter
DROP FUNCTION IF EXISTS public.deduct_wallet_balance(uuid, numeric, text);

CREATE OR REPLACE FUNCTION public.deduct_wallet_balance(
  p_user_id uuid,
  p_amount numeric,
  p_description text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_balance NUMERIC;
  v_transaction_id UUID;
  v_existing_id UUID;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: Cannot deduct from other users wallet';
  END IF;
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid amount: Must be positive';
  END IF;

  IF p_idempotency_key IS NOT NULL AND length(trim(p_idempotency_key)) > 0 THEN
    SELECT id INTO v_existing_id
    FROM public.wallet_transactions
    WHERE user_id = p_user_id AND idempotency_key = p_idempotency_key
    LIMIT 1;
    IF v_existing_id IS NOT NULL THEN
      RETURN v_existing_id::text;
    END IF;
  END IF;

  SELECT balance INTO v_current_balance
  FROM public.user_wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    INSERT INTO public.user_wallets (user_id, balance) VALUES (p_user_id, 0);
    RAISE EXCEPTION 'Insufficient wallet balance';
  END IF;
  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient wallet balance';
  END IF;

  UPDATE public.user_wallets
     SET balance = balance - p_amount, updated_at = NOW()
   WHERE user_id = p_user_id;

  BEGIN
    INSERT INTO public.wallet_transactions (user_id, type, amount, status, admin_notes, idempotency_key)
    VALUES (p_user_id, 'withdrawal', p_amount, 'completed', p_description, p_idempotency_key)
    RETURNING id INTO v_transaction_id;
  EXCEPTION WHEN unique_violation THEN
    UPDATE public.user_wallets
       SET balance = balance + p_amount, updated_at = NOW()
     WHERE user_id = p_user_id;
    SELECT id INTO v_transaction_id
      FROM public.wallet_transactions
     WHERE user_id = p_user_id AND idempotency_key = p_idempotency_key
     LIMIT 1;
  END;

  RETURN v_transaction_id::text;
END;
$$;