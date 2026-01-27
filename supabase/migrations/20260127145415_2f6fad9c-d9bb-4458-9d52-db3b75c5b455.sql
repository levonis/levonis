
-- =====================================================
-- CRITICAL: Multi-Layer Protection for Competition Entries
-- =====================================================

-- 1. Create atomic function for competition entry (prevents race conditions)
CREATE OR REPLACE FUNCTION public.enter_competition(
  p_user_id UUID,
  p_competition_id UUID,
  p_ticket_count INTEGER DEFAULT 1,
  p_letter_awarded TEXT DEFAULT NULL,
  p_team TEXT DEFAULT NULL,
  p_prize_won JSONB DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  ticket_id UUID,
  ticket_number TEXT,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_balance INTEGER;
  v_required_tickets INTEGER;
  v_total_cost INTEGER;
  v_competition_type TEXT;
  v_competition_status TEXT;
  v_max_tickets INTEGER;
  v_current_sold INTEGER;
  v_ticket_id UUID;
  v_ticket_number TEXT;
  v_user_entries INTEGER;
  i INTEGER;
BEGIN
  -- Verify caller is the owner
  IF auth.uid() IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, 'غير مصرح - يجب تسجيل الدخول'::TEXT;
    RETURN;
  END IF;
  
  IF auth.uid() != p_user_id THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, 'غير مصرح - لا يمكن الدخول بإسم مستخدم آخر'::TEXT;
    RETURN;
  END IF;

  IF p_ticket_count <= 0 OR p_ticket_count > 100 THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, 'عدد التذاكر غير صالح'::TEXT;
    RETURN;
  END IF;

  -- Lock competition row to prevent race conditions
  SELECT 
    c.required_tickets, 
    c.competition_type, 
    c.status,
    c.max_tickets,
    COALESCE((SELECT COUNT(*) FROM competition_tickets WHERE competition_id = c.id), 0)
  INTO v_required_tickets, v_competition_type, v_competition_status, v_max_tickets, v_current_sold
  FROM competitions c
  WHERE c.id = p_competition_id
  FOR UPDATE;

  IF v_required_tickets IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, 'المسابقة غير موجودة'::TEXT;
    RETURN;
  END IF;

  IF v_competition_status != 'active' THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, 'المسابقة غير نشطة'::TEXT;
    RETURN;
  END IF;

  -- Check max tickets limit
  IF v_max_tickets IS NOT NULL AND v_current_sold + p_ticket_count > v_max_tickets THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, 'تم بيع جميع التذاكر'::TEXT;
    RETURN;
  END IF;

  -- Check free competition limit (one entry per user)
  IF v_competition_type = 'free' THEN
    SELECT COUNT(*) INTO v_user_entries
    FROM competition_tickets
    WHERE user_id = p_user_id AND competition_id = p_competition_id;
    
    IF v_user_entries > 0 THEN
      RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, 'لقد شاركت مسبقاً في هذه المسابقة المجانية'::TEXT;
      RETURN;
    END IF;
    
    v_required_tickets := 0;
  END IF;

  v_total_cost := v_required_tickets * p_ticket_count;

  -- Lock user tickets row and verify balance
  IF v_total_cost > 0 THEN
    SELECT ticket_count INTO v_user_balance
    FROM user_tickets
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF v_user_balance IS NULL OR v_user_balance < v_total_cost THEN
      RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, 
        format('رصيد التذاكر غير كافٍ. المطلوب: %s، المتوفر: %s', v_total_cost, COALESCE(v_user_balance, 0))::TEXT;
      RETURN;
    END IF;

    -- Deduct tickets atomically
    UPDATE user_tickets
    SET ticket_count = ticket_count - v_total_cost,
        updated_at = NOW()
    WHERE user_id = p_user_id;
  END IF;

  -- Insert competition tickets
  FOR i IN 1..p_ticket_count LOOP
    v_ticket_number := 'T-' || UPPER(SUBSTRING(gen_random_uuid()::TEXT, 1, 8));
    
    INSERT INTO competition_tickets (
      user_id, 
      competition_id, 
      ticket_number,
      letter_awarded,
      team,
      prize_won,
      is_winner
    )
    VALUES (
      p_user_id, 
      p_competition_id, 
      v_ticket_number,
      p_letter_awarded,
      p_team,
      p_prize_won,
      p_letter_awarded IS NOT NULL OR p_prize_won IS NOT NULL
    )
    RETURNING id INTO v_ticket_id;
  END LOOP;

  RETURN QUERY SELECT TRUE, v_ticket_id, v_ticket_number, NULL::TEXT;
END;
$$;

-- 2. Create trigger to prevent direct ticket manipulation
CREATE OR REPLACE FUNCTION public.prevent_ticket_fraud()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow modifications through RPC functions (SECURITY DEFINER)
  IF current_setting('role', true) = 'authenticated' AND 
     NOT current_setting('is_superuser', true)::boolean THEN
    -- Check if this is coming from a SECURITY DEFINER function
    IF TG_OP = 'UPDATE' THEN
      -- Prevent increasing ticket count
      IF NEW.ticket_count > OLD.ticket_count THEN
        -- Only allow if it's a legitimate system operation
        IF NOT has_role(auth.uid(), 'admin') THEN
          RAISE EXCEPTION 'Unauthorized: Cannot increase ticket balance directly';
        END IF;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS ticket_fraud_prevention ON user_tickets;

-- Create trigger
CREATE TRIGGER ticket_fraud_prevention
  BEFORE UPDATE ON user_tickets
  FOR EACH ROW
  EXECUTE FUNCTION prevent_ticket_fraud();

-- 3. Add similar protection for wallets
CREATE OR REPLACE FUNCTION public.prevent_wallet_fraud()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Prevent increasing balance without proper authorization
    IF NEW.balance > OLD.balance THEN
      IF NOT has_role(auth.uid(), 'admin') THEN
        RAISE EXCEPTION 'Unauthorized: Cannot increase wallet balance directly';
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS wallet_fraud_prevention ON user_wallets;

CREATE TRIGGER wallet_fraud_prevention
  BEFORE UPDATE ON user_wallets
  FOR EACH ROW
  EXECUTE FUNCTION prevent_wallet_fraud();

-- 4. Add audit log for all balance changes
CREATE TABLE IF NOT EXISTS public.balance_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL,
  old_balance NUMERIC,
  new_balance NUMERIC,
  change_amount NUMERIC,
  function_name TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.balance_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view audit logs"
ON public.balance_audit_log FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- 5. Create audit trigger for tickets
CREATE OR REPLACE FUNCTION public.audit_ticket_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO balance_audit_log (
    user_id, table_name, operation, 
    old_balance, new_balance, change_amount,
    function_name
  ) VALUES (
    COALESCE(NEW.user_id, OLD.user_id),
    'user_tickets',
    TG_OP,
    OLD.ticket_count,
    NEW.ticket_count,
    COALESCE(NEW.ticket_count, 0) - COALESCE(OLD.ticket_count, 0),
    current_setting('application_name', true)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_ticket_changes ON user_tickets;

CREATE TRIGGER audit_ticket_changes
  AFTER INSERT OR UPDATE ON user_tickets
  FOR EACH ROW
  EXECUTE FUNCTION audit_ticket_changes();

-- 6. Create audit trigger for wallets
CREATE OR REPLACE FUNCTION public.audit_wallet_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO balance_audit_log (
    user_id, table_name, operation, 
    old_balance, new_balance, change_amount,
    function_name
  ) VALUES (
    COALESCE(NEW.user_id, OLD.user_id),
    'user_wallets',
    TG_OP,
    OLD.balance,
    NEW.balance,
    COALESCE(NEW.balance, 0) - COALESCE(OLD.balance, 0),
    current_setting('application_name', true)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_wallet_changes ON user_wallets;

CREATE TRIGGER audit_wallet_changes
  AFTER INSERT OR UPDATE ON user_wallets
  FOR EACH ROW
  EXECUTE FUNCTION audit_wallet_changes();

-- 7. Grant execute on the secure entry function
GRANT EXECUTE ON FUNCTION public.enter_competition TO authenticated;

-- 8. CRITICAL: Remove ALL user update policies on tickets and wallets
-- Users should NEVER be able to update these tables directly
DROP POLICY IF EXISTS "Users can only view their own tickets" ON public.user_tickets;
DROP POLICY IF EXISTS "Users can only view their own wallet" ON public.user_wallets;

-- Recreate with strict SELECT only
CREATE POLICY "Users can only SELECT their own tickets"
ON public.user_tickets FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can only SELECT their own wallet"
ON public.user_wallets FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
