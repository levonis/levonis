-- =====================================================
-- CRITICAL SECURITY FIXES - Closing discovered vulnerabilities
-- =====================================================

-- 1. REMOVE direct INSERT on competition_tickets (CRITICAL!)
-- Users MUST use enter_competition function only
DROP POLICY IF EXISTS "Users can purchase tickets" ON competition_tickets;

-- Ensure only admins and system (via SECURITY DEFINER functions) can insert
-- The enter_competition function already handles this securely

-- 2. FIX chat_orders - restrict UPDATE to safe fields only via trigger
CREATE OR REPLACE FUNCTION public.prevent_chat_order_price_manipulation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admins can change prices
  IF NOT has_role(auth.uid(), 'admin') THEN
    -- Prevent price/amount changes by non-admins
    IF NEW.unit_price != OLD.unit_price OR 
       NEW.total_price != OLD.total_price OR
       NEW.commission_rate != OLD.commission_rate OR
       NEW.commission_amount != OLD.commission_amount OR
       NEW.paid_amount IS DISTINCT FROM OLD.paid_amount OR
       NEW.remaining_amount IS DISTINCT FROM OLD.remaining_amount THEN
      RAISE EXCEPTION 'غير مصرح لك بتعديل الأسعار';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_price_manipulation ON chat_orders;
CREATE TRIGGER prevent_price_manipulation
  BEFORE UPDATE ON chat_orders
  FOR EACH ROW
  EXECUTE FUNCTION prevent_chat_order_price_manipulation();

-- 3. FIX orders table - add trigger to prevent price manipulation
CREATE OR REPLACE FUNCTION public.prevent_order_price_manipulation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- On INSERT, verify user is creating order for themselves
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'يجب تسجيل الدخول';
    END IF;
    
    -- Force user_id to be the authenticated user (prevent creating orders for others)
    IF NEW.user_id != auth.uid() AND NOT has_role(auth.uid(), 'admin') THEN
      RAISE EXCEPTION 'لا يمكنك إنشاء طلب لمستخدم آخر';
    END IF;
  END IF;
  
  -- On UPDATE, prevent price changes by non-admins
  IF TG_OP = 'UPDATE' THEN
    IF NOT has_role(auth.uid(), 'admin') THEN
      IF NEW.total_price != OLD.total_price OR
         NEW.partial_amount IS DISTINCT FROM OLD.partial_amount OR
         NEW.wallet_deducted IS DISTINCT FROM OLD.wallet_deducted OR
         NEW.coupon_discount IS DISTINCT FROM OLD.coupon_discount THEN
        RAISE EXCEPTION 'غير مصرح لك بتعديل الأسعار';
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_order_price_change ON orders;
CREATE TRIGGER prevent_order_price_change
  BEFORE INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION prevent_order_price_manipulation();

-- 4. FIX print_offers - prevent price changes after acceptance
CREATE OR REPLACE FUNCTION public.prevent_offer_manipulation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request_status TEXT;
BEGIN
  -- Get request status
  SELECT status INTO v_request_status
  FROM community_print_requests
  WHERE id = NEW.request_id;
  
  -- If offer was accepted (request has accepted_offer_id), prevent changes to price
  IF OLD.status = 'accepted' OR v_request_status IN ('accepted', 'in_progress', 'delivered', 'confirmed') THEN
    IF NOT has_role(auth.uid(), 'admin') THEN
      IF NEW.price != OLD.price OR 
         NEW.delivery_days != OLD.delivery_days THEN
        RAISE EXCEPTION 'لا يمكن تعديل العرض بعد القبول';
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_offer_change ON print_offers;
CREATE TRIGGER prevent_offer_change
  BEFORE UPDATE ON print_offers
  FOR EACH ROW
  EXECUTE FUNCTION prevent_offer_manipulation();

-- 5. Add audit logging for suspicious activities
CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action TEXT NOT NULL,
  table_name TEXT,
  details JSONB,
  ip_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view security logs" ON security_audit_log
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- 6. RESTRICTIVE policy on competition_tickets
DROP POLICY IF EXISTS "Require authentication for competition tickets" ON competition_tickets;

-- Only allow SELECT for users, everything else via functions
CREATE POLICY "competition_tickets_user_select" ON competition_tickets
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "competition_tickets_admin_all" ON competition_tickets
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));