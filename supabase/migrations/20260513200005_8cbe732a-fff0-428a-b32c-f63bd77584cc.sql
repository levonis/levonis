-- Wallet deduction audit log: link wallet_transactions to orders + breakdown
ALTER TABLE public.wallet_transactions
  ADD COLUMN IF NOT EXISTS order_id uuid,
  ADD COLUMN IF NOT EXISTS breakdown jsonb,
  ADD COLUMN IF NOT EXISTS balance_before numeric;

CREATE INDEX IF NOT EXISTS idx_wallet_tx_order_id
  ON public.wallet_transactions (order_id)
  WHERE order_id IS NOT NULL;

-- RPC: link a wallet transaction to an order with full breakdown.
-- Owner of the transaction OR admin may call. Idempotent.
CREATE OR REPLACE FUNCTION public.link_wallet_tx_to_order(
  p_transaction_id uuid,
  p_order_id uuid,
  p_breakdown jsonb,
  p_balance_before numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT user_id INTO v_user_id
    FROM public.wallet_transactions
   WHERE id = p_transaction_id
   LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Wallet transaction not found';
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF auth.uid() <> v_user_id
     AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.wallet_transactions
     SET order_id = COALESCE(order_id, p_order_id),
         breakdown = COALESCE(breakdown, p_breakdown),
         balance_before = COALESCE(balance_before, p_balance_before),
         updated_at = NOW()
   WHERE id = p_transaction_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_wallet_tx_to_order TO authenticated;

-- Admin-readable audit view scoped to a specific order
CREATE OR REPLACE FUNCTION public.get_order_wallet_log(p_order_id uuid)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  amount numeric,
  balance_before numeric,
  balance_after numeric,
  breakdown jsonb,
  description text,
  status text,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT wt.id, wt.user_id, wt.amount, wt.balance_before, wt.balance_after,
         wt.breakdown, wt.admin_notes AS description, wt.status, wt.created_at
    FROM public.wallet_transactions wt
   WHERE wt.order_id = p_order_id
     AND (
       auth.uid() = wt.user_id
       OR public.has_role(auth.uid(), 'admin'::app_role)
     )
   ORDER BY wt.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_wallet_log TO authenticated;