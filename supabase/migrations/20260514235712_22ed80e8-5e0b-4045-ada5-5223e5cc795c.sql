-- Donations log table (proof feed)
CREATE TABLE public.donations_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL,
  display_name text NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  source text NOT NULL CHECK (source IN ('order_auto','order_extra','wallet_direct')),
  order_id uuid NULL,
  currency text NOT NULL DEFAULT 'IQD',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_donations_log_created_at ON public.donations_log (created_at DESC);
CREATE INDEX idx_donations_log_user_id ON public.donations_log (user_id);

ALTER TABLE public.donations_log ENABLE ROW LEVEL SECURITY;

-- Public read (proof page)
CREATE POLICY "Donations log is viewable by everyone"
ON public.donations_log FOR SELECT
USING (true);

-- No client writes; only SECURITY DEFINER funcs/triggers
-- (no INSERT/UPDATE/DELETE policies)

-- Trigger: when an order is created with donations, log them
CREATE OR REPLACE FUNCTION public.log_order_donations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  IF (COALESCE(NEW.auto_donation_amount, 0) > 0) OR (COALESCE(NEW.extra_donation_amount, 0) > 0) THEN
    SELECT COALESCE(full_name, username) INTO v_name
      FROM public.profiles WHERE id = NEW.user_id;
  END IF;

  IF COALESCE(NEW.auto_donation_amount, 0) > 0 THEN
    INSERT INTO public.donations_log (user_id, display_name, amount, source, order_id)
    VALUES (NEW.user_id, v_name, NEW.auto_donation_amount, 'order_auto', NEW.id);
  END IF;

  IF COALESCE(NEW.extra_donation_amount, 0) > 0 THEN
    INSERT INTO public.donations_log (user_id, display_name, amount, source, order_id)
    VALUES (NEW.user_id, v_name, NEW.extra_donation_amount, 'order_extra', NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_order_donations
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.log_order_donations();

-- Direct wallet donation RPC
CREATE OR REPLACE FUNCTION public.donate_from_wallet(p_amount numeric)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_balance numeric;
  v_name text;
  v_log_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT';
  END IF;

  -- Lock wallet row
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

  UPDATE public.user_wallets
    SET balance = balance - p_amount,
        updated_at = now()
    WHERE user_id = v_user;

  INSERT INTO public.wallet_transactions (user_id, amount, transaction_type, description)
  VALUES (v_user, -p_amount, 'donation', 'تبرع لمؤسسة العين/ودور الأيتام');

  SELECT COALESCE(full_name, username) INTO v_name
    FROM public.profiles WHERE id = v_user;

  INSERT INTO public.donations_log (user_id, display_name, amount, source)
  VALUES (v_user, v_name, p_amount, 'wallet_direct')
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.donate_from_wallet(numeric) TO authenticated;

-- Public stats RPC
CREATE OR REPLACE FUNCTION public.get_donations_stats()
RETURNS TABLE (
  total_amount numeric,
  total_count bigint,
  donor_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(SUM(amount), 0)::numeric AS total_amount,
    COUNT(*)::bigint AS total_count,
    COUNT(DISTINCT user_id)::bigint AS donor_count
  FROM public.donations_log;
$$;

GRANT EXECUTE ON FUNCTION public.get_donations_stats() TO anon, authenticated;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.donations_log;

-- Backfill from existing orders
INSERT INTO public.donations_log (user_id, display_name, amount, source, order_id, created_at)
SELECT o.user_id,
       COALESCE(p.full_name, p.username),
       o.auto_donation_amount,
       'order_auto',
       o.id,
       o.created_at
FROM public.orders o
LEFT JOIN public.profiles p ON p.id = o.user_id
WHERE COALESCE(o.auto_donation_amount, 0) > 0;

INSERT INTO public.donations_log (user_id, display_name, amount, source, order_id, created_at)
SELECT o.user_id,
       COALESCE(p.full_name, p.username),
       o.extra_donation_amount,
       'order_extra',
       o.id,
       o.created_at
FROM public.orders o
LEFT JOIN public.profiles p ON p.id = o.user_id
WHERE COALESCE(o.extra_donation_amount, 0) > 0;