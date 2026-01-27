
-- Admin-only function to adjust wallet balance (for merchant fees, refunds, etc.)
CREATE OR REPLACE FUNCTION public.admin_adjust_wallet(
  p_user_id UUID,
  p_amount NUMERIC,
  p_type TEXT,
  p_description TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transaction_id UUID;
BEGIN
  -- Only admins can call this
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  -- Upsert wallet if needed
  INSERT INTO user_wallets (user_id, balance)
  VALUES (p_user_id, GREATEST(0, p_amount))
  ON CONFLICT (user_id)
  DO UPDATE SET 
    balance = CASE 
      WHEN p_amount >= 0 THEN user_wallets.balance + p_amount
      ELSE GREATEST(0, user_wallets.balance + p_amount)
    END,
    updated_at = NOW();
  
  -- Create transaction record
  INSERT INTO wallet_transactions (user_id, type, amount, status, admin_notes)
  VALUES (p_user_id, p_type, ABS(p_amount), 'completed', p_description)
  RETURNING id INTO v_transaction_id;
  
  RETURN v_transaction_id;
END;
$$;

-- Admin-only function to adjust tickets
CREATE OR REPLACE FUNCTION public.admin_adjust_tickets(
  p_user_id UUID,
  p_amount INTEGER,
  p_source TEXT DEFAULT 'admin'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admins can call this
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  -- Upsert ticket balance
  INSERT INTO user_tickets (user_id, ticket_count)
  VALUES (p_user_id, GREATEST(0, p_amount))
  ON CONFLICT (user_id)
  DO UPDATE SET 
    ticket_count = CASE 
      WHEN p_amount >= 0 THEN user_tickets.ticket_count + p_amount
      ELSE GREATEST(0, user_tickets.ticket_count + p_amount)
    END,
    updated_at = NOW();
  
  RETURN TRUE;
END;
$$;

-- Admin-only function to adjust points
CREATE OR REPLACE FUNCTION public.admin_adjust_points(
  p_user_id UUID,
  p_amount NUMERIC,
  p_source TEXT DEFAULT 'admin',
  p_description TEXT DEFAULT 'Admin adjustment'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transaction_id UUID;
  v_type TEXT;
BEGIN
  -- Only admins can call this
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  v_type := CASE WHEN p_amount >= 0 THEN 'earn' ELSE 'spend' END;

  -- Create transaction
  INSERT INTO points_transactions (user_id, points, type, source, description)
  VALUES (p_user_id, p_amount, v_type, p_source, p_description)
  RETURNING id INTO v_transaction_id;
  
  -- Upsert and recalculate points
  INSERT INTO user_points (user_id, total_points, available_points)
  VALUES (p_user_id, GREATEST(0, p_amount), GREATEST(0, p_amount))
  ON CONFLICT (user_id)
  DO UPDATE SET 
    total_points = CASE WHEN p_amount > 0 THEN user_points.total_points + p_amount ELSE user_points.total_points END,
    available_points = (
      SELECT COALESCE(SUM(points), 0)
      FROM points_transactions
      WHERE user_id = p_user_id
    ),
    updated_at = NOW();
  
  RETURN v_transaction_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_adjust_wallet TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjust_tickets TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjust_points TO authenticated;
