
CREATE OR REPLACE FUNCTION public.charge_merchant_registration_fee_on_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance NUMERIC;
  v_tx_id UUID;
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    -- Prevent double-charging
    IF COALESCE(NEW.fee_status, 'unpaid') = 'paid' THEN
      RETURN NEW;
    END IF;

    -- Skip if registration fee is 0 or null (free)
    IF COALESCE(NEW.registration_fee, 0) <= 0 THEN
      NEW.fee_status := 'paid';
      RETURN NEW;
    END IF;

    -- Ensure wallet exists, create if not
    INSERT INTO public.user_wallets (user_id, balance)
    VALUES (NEW.user_id, 0)
    ON CONFLICT (user_id) DO NOTHING;

    -- Lock wallet row during charge
    SELECT uw.balance
      INTO v_balance
    FROM public.user_wallets uw
    WHERE uw.user_id = NEW.user_id
    FOR UPDATE;

    IF v_balance < NEW.registration_fee THEN
      -- Instead of blocking approval, add fee to merchant's total_debt
      -- Record the transaction as pending
      INSERT INTO public.wallet_transactions (
        user_id, type, amount, status, admin_notes, payment_method, created_at, updated_at
      ) VALUES (
        NEW.user_id, 'merchant_registration_fee', NEW.registration_fee, 'completed',
        'رسوم تسجيل التاجر - مضافة كدين', 'debt', now(), now()
      )
      RETURNING id INTO v_tx_id;

      -- Add to merchant's total_debt on their public profile
      UPDATE public.merchant_public_profiles
        SET total_debt = COALESCE(total_debt, 0) + NEW.registration_fee,
            updated_at = now()
      WHERE id = NEW.id;

      NEW.fee_status := 'debt';
      NEW.fee_transaction_id := v_tx_id;
    ELSE
      -- Sufficient balance: deduct normally
      UPDATE public.user_wallets
        SET balance = balance - NEW.registration_fee,
            updated_at = now()
      WHERE user_id = NEW.user_id;

      INSERT INTO public.wallet_transactions (
        user_id, type, amount, status, admin_notes, payment_method, created_at, updated_at
      ) VALUES (
        NEW.user_id, 'merchant_registration_fee', NEW.registration_fee, 'completed',
        'Merchant registration fee', 'wallet', now(), now()
      )
      RETURNING id INTO v_tx_id;

      NEW.fee_status := 'paid';
      NEW.fee_transaction_id := v_tx_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
