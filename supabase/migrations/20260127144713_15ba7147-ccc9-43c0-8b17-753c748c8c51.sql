
-- =====================================================
-- CRITICAL SECURITY FIX: Tickets, Wallets, Points
-- =====================================================

-- 1. DROP insecure ALL policies that allow users to modify their own balances
DROP POLICY IF EXISTS "Require authentication for user tickets" ON public.user_tickets;
DROP POLICY IF EXISTS "Require authentication for wallet access" ON public.user_wallets;
DROP POLICY IF EXISTS "Users can update their own wallet" ON public.user_wallets;
DROP POLICY IF EXISTS "Require authentication for points access" ON public.user_points;
DROP POLICY IF EXISTS "Require authentication for wallet transactions" ON public.wallet_transactions;
DROP POLICY IF EXISTS "Require authentication for points transactions" ON public.points_transactions;

-- 2. Create secure SELECT-only policies for users
-- User Tickets: Users can only VIEW their tickets, not modify
CREATE POLICY "Users can only view their own tickets"
ON public.user_tickets FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- User Wallets: Users can only VIEW their wallet, not modify
CREATE POLICY "Users can only view their own wallet"
ON public.user_wallets FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- User Points: Users can only VIEW their points, not modify
CREATE POLICY "Users can only view their own points"
ON public.user_points FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Wallet Transactions: Users can only VIEW, admins handle INSERT
-- Remove user insert capability
DROP POLICY IF EXISTS "Users can create their own wallet transactions" ON public.wallet_transactions;

-- 3. Create SECURITY DEFINER functions for safe balance operations

-- Function to safely deduct tickets (atomic operation)
CREATE OR REPLACE FUNCTION public.deduct_user_tickets(
  p_user_id UUID,
  p_amount INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance INTEGER;
BEGIN
  -- Verify the caller is the owner
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: Cannot deduct tickets for other users';
  END IF;
  
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid amount: Must be positive';
  END IF;

  -- Lock the row and get current balance
  SELECT ticket_count INTO v_current_balance
  FROM user_tickets
  WHERE user_id = p_user_id
  FOR UPDATE;
  
  IF v_current_balance IS NULL THEN
    RAISE EXCEPTION 'User tickets record not found';
  END IF;
  
  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient ticket balance';
  END IF;
  
  -- Perform atomic update
  UPDATE user_tickets
  SET ticket_count = ticket_count - p_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id;
  
  RETURN TRUE;
END;
$$;

-- Function to safely add tickets (admin or system only)
CREATE OR REPLACE FUNCTION public.add_user_tickets(
  p_user_id UUID,
  p_amount INTEGER,
  p_source TEXT DEFAULT 'system'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid amount: Must be positive';
  END IF;

  -- Upsert ticket balance
  INSERT INTO user_tickets (user_id, ticket_count)
  VALUES (p_user_id, p_amount)
  ON CONFLICT (user_id)
  DO UPDATE SET 
    ticket_count = user_tickets.ticket_count + p_amount,
    updated_at = NOW();
  
  RETURN TRUE;
END;
$$;

-- Function to safely deduct wallet balance (for payments)
CREATE OR REPLACE FUNCTION public.deduct_wallet_balance(
  p_user_id UUID,
  p_amount NUMERIC,
  p_description TEXT DEFAULT 'Payment'
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
    RAISE EXCEPTION 'Unauthorized: Cannot deduct from other users wallet';
  END IF;
  
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid amount: Must be positive';
  END IF;

  -- Lock the row and get current balance
  SELECT balance INTO v_current_balance
  FROM user_wallets
  WHERE user_id = p_user_id
  FOR UPDATE;
  
  IF v_current_balance IS NULL THEN
    RAISE EXCEPTION 'User wallet not found';
  END IF;
  
  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient wallet balance';
  END IF;
  
  -- Perform atomic update
  UPDATE user_wallets
  SET balance = balance - p_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id;
  
  -- Create transaction record
  INSERT INTO wallet_transactions (user_id, type, amount, status, admin_notes)
  VALUES (p_user_id, 'withdrawal', p_amount, 'completed', p_description)
  RETURNING id INTO v_transaction_id;
  
  RETURN v_transaction_id;
END;
$$;

-- Function to safely deduct points
CREATE OR REPLACE FUNCTION public.deduct_user_points(
  p_user_id UUID,
  p_amount NUMERIC,
  p_source TEXT DEFAULT 'redemption',
  p_description TEXT DEFAULT 'Points redemption'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_points NUMERIC;
  v_transaction_id UUID;
BEGIN
  -- Verify the caller is the owner
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: Cannot deduct points for other users';
  END IF;
  
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid amount: Must be positive';
  END IF;

  -- Lock the row and get current balance
  SELECT available_points INTO v_current_points
  FROM user_points
  WHERE user_id = p_user_id
  FOR UPDATE;
  
  IF v_current_points IS NULL THEN
    RAISE EXCEPTION 'User points record not found';
  END IF;
  
  IF v_current_points < p_amount THEN
    RAISE EXCEPTION 'Insufficient points balance';
  END IF;
  
  -- Create spend transaction first (ledger principle)
  INSERT INTO points_transactions (user_id, points, type, source, description)
  VALUES (p_user_id, -p_amount, 'spend', p_source, p_description)
  RETURNING id INTO v_transaction_id;
  
  -- Recalculate balance from transaction history
  UPDATE user_points
  SET available_points = (
    SELECT COALESCE(SUM(points), 0)
    FROM points_transactions
    WHERE user_id = p_user_id
  ),
  updated_at = NOW()
  WHERE user_id = p_user_id;
  
  RETURN v_transaction_id;
END;
$$;

-- 4. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.deduct_user_tickets TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_user_tickets TO authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_wallet_balance TO authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_user_points TO authenticated;
