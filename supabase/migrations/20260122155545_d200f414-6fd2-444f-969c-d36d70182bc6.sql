-- 1) Extend merchant_applications to support 3-step onboarding + fee tracking
ALTER TABLE public.merchant_applications
  ADD COLUMN IF NOT EXISTS store_image_url TEXT,
  ADD COLUMN IF NOT EXISTS social_links JSONB,
  ADD COLUMN IF NOT EXISTS registration_fee NUMERIC NOT NULL DEFAULT 25000,
  ADD COLUMN IF NOT EXISTS fee_status TEXT NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS fee_transaction_id UUID;

-- 2) Private (admin-oriented) details kept in a separate table
CREATE TABLE IF NOT EXISTS public.merchant_application_private (
  application_id UUID PRIMARY KEY
    REFERENCES public.merchant_applications(id) ON DELETE CASCADE,
  legal_full_name TEXT,
  nickname TEXT,
  address TEXT,
  phone_number TEXT,
  gender TEXT,
  birth_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.merchant_application_private ENABLE ROW LEVEL SECURITY;

-- Users can read their own private details (needed for editing the wizard)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
      AND tablename='merchant_application_private'
      AND policyname='Users can view their own merchant private details'
  ) THEN
    CREATE POLICY "Users can view their own merchant private details"
    ON public.merchant_application_private
    FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.merchant_applications ma
        WHERE ma.id = merchant_application_private.application_id
          AND ma.user_id = auth.uid()
      )
    );
  END IF;
END$$;

-- Users can create their own private details row
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
      AND tablename='merchant_application_private'
      AND policyname='Users can insert their own merchant private details'
  ) THEN
    CREATE POLICY "Users can insert their own merchant private details"
    ON public.merchant_application_private
    FOR INSERT
    TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.merchant_applications ma
        WHERE ma.id = merchant_application_private.application_id
          AND ma.user_id = auth.uid()
      )
    );
  END IF;
END$$;

-- Users can update their own private details row
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
      AND tablename='merchant_application_private'
      AND policyname='Users can update their own merchant private details'
  ) THEN
    CREATE POLICY "Users can update their own merchant private details"
    ON public.merchant_application_private
    FOR UPDATE
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.merchant_applications ma
        WHERE ma.id = merchant_application_private.application_id
          AND ma.user_id = auth.uid()
      )
    );
  END IF;
END$$;

-- Admins can read/update all private details
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
      AND tablename='merchant_application_private'
      AND policyname='Admins can manage merchant private details'
  ) THEN
    CREATE POLICY "Admins can manage merchant private details"
    ON public.merchant_application_private
    FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END$$;

-- Keep updated_at fresh (re-use existing trigger fn if present)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'update_updated_at_column'
      AND pg_function_is_visible(oid)
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'update_merchant_application_private_updated_at'
    ) THEN
      CREATE TRIGGER update_merchant_application_private_updated_at
      BEFORE UPDATE ON public.merchant_application_private
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
  END IF;
END$$;

-- 3) Merchant store image bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('merchant_stores', 'merchant_stores', true)
ON CONFLICT (id) DO NOTHING;

-- Public can read store images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage'
      AND tablename='objects'
      AND policyname='Merchant store images are publicly accessible'
  ) THEN
    CREATE POLICY "Merchant store images are publicly accessible"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'merchant_stores');
  END IF;
END$$;

-- Authenticated users can upload/update/delete only within their folder: {user_id}/...
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage'
      AND tablename='objects'
      AND policyname='Users can upload their own merchant store images'
  ) THEN
    CREATE POLICY "Users can upload their own merchant store images"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'merchant_stores'
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage'
      AND tablename='objects'
      AND policyname='Users can update their own merchant store images'
  ) THEN
    CREATE POLICY "Users can update their own merchant store images"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'merchant_stores'
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage'
      AND tablename='objects'
      AND policyname='Users can delete their own merchant store images'
  ) THEN
    CREATE POLICY "Users can delete their own merchant store images"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'merchant_stores'
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END$$;

-- 4) Charge merchant registration fee on admin approval
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

    -- Lock wallet row during charge
    SELECT uw.balance
      INTO v_balance
    FROM public.user_wallets uw
    WHERE uw.user_id = NEW.user_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'WALLET_NOT_FOUND';
    END IF;

    IF v_balance < NEW.registration_fee THEN
      RAISE EXCEPTION 'INSUFFICIENT_WALLET_BALANCE';
    END IF;

    UPDATE public.user_wallets
      SET balance = balance - NEW.registration_fee,
          updated_at = now()
    WHERE user_id = NEW.user_id;

    INSERT INTO public.wallet_transactions (
      user_id,
      type,
      amount,
      status,
      admin_notes,
      payment_method,
      created_at,
      updated_at
    ) VALUES (
      NEW.user_id,
      'merchant_registration_fee',
      NEW.registration_fee,
      'completed',
      'Merchant registration fee',
      'wallet',
      now(),
      now()
    )
    RETURNING id INTO v_tx_id;

    NEW.fee_status := 'paid';
    NEW.fee_transaction_id := v_tx_id;
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'charge_merchant_registration_fee_on_approval'
  ) THEN
    CREATE TRIGGER charge_merchant_registration_fee_on_approval
    BEFORE UPDATE ON public.merchant_applications
    FOR EACH ROW
    EXECUTE FUNCTION public.charge_merchant_registration_fee_on_approval();
  END IF;
END$$;