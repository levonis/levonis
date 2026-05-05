-- Allow trusted internal refund flow to bypass the balance-increase guard.
CREATE OR REPLACE FUNCTION public.prevent_wallet_fraud()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.balance > OLD.balance THEN
      -- Allow if admin OR if a trusted SECURITY DEFINER function flagged this update.
      IF NOT has_role(auth.uid(), 'admin')
         AND COALESCE(current_setting('app.refund_authorized', true), '') <> 'true' THEN
        RAISE EXCEPTION 'Unauthorized: Cannot increase wallet balance directly';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Idempotent, secure refund RPC.
CREATE OR REPLACE FUNCTION public.refund_wallet_balance(
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
  v_existing_id uuid;
  v_transaction_id uuid;
  v_caller uuid := auth.uid();
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid refund amount';
  END IF;

  IF v_caller IS NULL OR (v_caller <> p_user_id AND NOT has_role(v_caller, 'admin')) THEN
    RAISE EXCEPTION 'Unauthorized refund';
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

  PERFORM set_config('app.refund_authorized', 'true', true);

  INSERT INTO public.user_wallets (user_id, balance)
  VALUES (p_user_id, p_amount)
  ON CONFLICT (user_id) DO UPDATE
    SET balance = public.user_wallets.balance + EXCLUDED.balance,
        updated_at = now();

  PERFORM set_config('app.refund_authorized', 'false', true);

  INSERT INTO public.wallet_transactions (
    user_id, type, amount, status, admin_notes, idempotency_key
  ) VALUES (
    p_user_id, 'deposit', p_amount, 'completed',
    COALESCE(p_description, 'استرجاع تلقائي بسبب فشل إنشاء الطلب'),
    p_idempotency_key
  )
  RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id::text;
END;
$$;

-- Refund the affected user manually (only once).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.wallet_transactions
    WHERE user_id = '21156308-bcfe-4f22-9a15-c2513afe6067'
      AND idempotency_key = 'refund:direct_sale:ORD-20260505-0569'
  ) THEN
    PERFORM set_config('app.refund_authorized', 'true', true);
    UPDATE public.user_wallets
       SET balance = balance + 22000, updated_at = now()
     WHERE user_id = '21156308-bcfe-4f22-9a15-c2513afe6067';
    PERFORM set_config('app.refund_authorized', 'false', true);

    INSERT INTO public.wallet_transactions (
      user_id, type, amount, status, admin_notes, idempotency_key
    ) VALUES (
      '21156308-bcfe-4f22-9a15-c2513afe6067',
      'deposit', 22000, 'completed',
      'استرجاع يدوي: تم خصم المبلغ ولم يُنشأ الطلب ORD-20260505-0569',
      'refund:direct_sale:ORD-20260505-0569'
    );
  END IF;
END $$;