
-- ==========================================
-- COMMUNITY SECURITY HARDENING - FIXED
-- ==========================================

-- 1. Drop and recreate the problematic function
DROP FUNCTION IF EXISTS public.verify_printer_serial(TEXT);

CREATE OR REPLACE FUNCTION public.verify_printer_serial(p_serial_number TEXT)
RETURNS TABLE(id UUID, model_name TEXT, model_name_ar TEXT, is_available BOOLEAN) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sp.id,
        sp.model_name,
        sp.model_name_ar,
        NOT sp.is_registered AS is_available
    FROM public.store_printers sp
    WHERE sp.serial_number = p_serial_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Prevent escrow amount manipulation (Critical!)
CREATE OR REPLACE FUNCTION public.prevent_escrow_manipulation()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NOT public.has_role(auth.uid(), 'admin') THEN
      IF NEW.amount IS DISTINCT FROM OLD.amount THEN
        RAISE EXCEPTION 'غير مصرح لك بتعديل مبالغ الضمان';
      END IF;
      IF NEW.merchant_payout IS DISTINCT FROM OLD.merchant_payout THEN
        RAISE EXCEPTION 'غير مصرح لك بتعديل مبلغ التاجر';
      END IF;
      IF NEW.platform_fee IS DISTINCT FROM OLD.platform_fee THEN
        RAISE EXCEPTION 'غير مصرح لك بتعديل عمولة المنصة';
      END IF;
      IF OLD.status = 'released' AND NEW.status = 'held' THEN
        RAISE EXCEPTION 'لا يمكن إعادة حجز مبلغ تم تحريره';
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS prevent_escrow_manipulation_trigger ON escrow_transactions;
CREATE TRIGGER prevent_escrow_manipulation_trigger
  BEFORE UPDATE ON escrow_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_escrow_manipulation();

-- 3. Prevent print offer price manipulation after acceptance
CREATE OR REPLACE FUNCTION public.prevent_print_offer_manipulation()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IN ('accepted', 'in_progress', 'delivered', 'completed') THEN
      IF NOT public.has_role(auth.uid(), 'admin') THEN
        IF NEW.price_iqd IS DISTINCT FROM OLD.price_iqd THEN
          RAISE EXCEPTION 'لا يمكن تعديل السعر بعد قبول العرض';
        END IF;
        IF NEW.execution_days IS DISTINCT FROM OLD.execution_days THEN
          RAISE EXCEPTION 'لا يمكن تعديل مدة التنفيذ بعد قبول العرض';
        END IF;
      END IF;
    END IF;
    
    IF OLD.trader_id != auth.uid() AND NOT public.has_role(auth.uid(), 'admin') THEN
      IF NEW.price_iqd IS DISTINCT FROM OLD.price_iqd 
         OR NEW.execution_days IS DISTINCT FROM OLD.execution_days 
         OR NEW.notes IS DISTINCT FROM OLD.notes THEN
        RAISE EXCEPTION 'لا يمكنك تعديل عروض الآخرين';
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS prevent_print_offer_manipulation_trigger ON print_offers;
CREATE TRIGGER prevent_print_offer_manipulation_trigger
  BEFORE UPDATE ON print_offers
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_print_offer_manipulation();

-- 4. Restrict community_customer_profiles visibility
DROP POLICY IF EXISTS "Anyone can view customer profiles" ON community_customer_profiles;

CREATE POLICY "Authenticated users can view basic profiles"
  ON community_customer_profiles
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      auth.uid() = user_id
      OR is_suspended = false
    )
  );

-- 5. Prevent message tampering after sending
CREATE OR REPLACE FUNCTION public.prevent_message_tampering()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NOT public.has_role(auth.uid(), 'admin') THEN
      IF NEW.content IS DISTINCT FROM OLD.content THEN
        RAISE EXCEPTION 'لا يمكن تعديل الرسائل بعد إرسالها';
      END IF;
      IF NEW.sender_id IS DISTINCT FROM OLD.sender_id THEN
        RAISE EXCEPTION 'لا يمكن تغيير مرسل الرسالة';
      END IF;
      IF NEW.message_type IS DISTINCT FROM OLD.message_type THEN
        RAISE EXCEPTION 'لا يمكن تغيير نوع الرسالة';
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS prevent_message_tampering_trigger ON listing_messages;
CREATE TRIGGER prevent_message_tampering_trigger
  BEFORE UPDATE ON listing_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_message_tampering();

-- 6. Prevent unauthorized reputation score manipulation
CREATE OR REPLACE FUNCTION public.prevent_reputation_manipulation()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NOT public.has_role(auth.uid(), 'admin') THEN
      IF NEW.reputation_score IS DISTINCT FROM OLD.reputation_score THEN
        RAISE EXCEPTION 'لا يمكن تعديل نقاط السمعة يدوياً';
      END IF;
      IF OLD.is_suspended = true AND NEW.is_suspended = false THEN
        RAISE EXCEPTION 'لا يمكن إلغاء الإيقاف ذاتياً';
      END IF;
      IF OLD.is_verified = false AND NEW.is_verified = true THEN
        RAISE EXCEPTION 'لا يمكن توثيق الحساب ذاتياً';
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS prevent_reputation_manipulation_trigger ON community_customer_profiles;
CREATE TRIGGER prevent_reputation_manipulation_trigger
  BEFORE UPDATE ON community_customer_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_reputation_manipulation();

-- 7. Rate limiting for community actions
CREATE TABLE IF NOT EXISTS public.community_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  action_count INTEGER DEFAULT 1,
  window_start TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.community_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own rate limits" ON community_rate_limits;
CREATE POLICY "Users can view their own rate limits"
  ON community_rate_limits FOR SELECT
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_user_id UUID,
  p_action_type TEXT,
  p_max_count INTEGER,
  p_window_minutes INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  v_count INTEGER;
  v_window_start TIMESTAMPTZ;
BEGIN
  v_window_start := now() - (p_window_minutes || ' minutes')::INTERVAL;
  
  SELECT COUNT(*) INTO v_count
  FROM public.community_rate_limits
  WHERE user_id = p_user_id
    AND action_type = p_action_type
    AND created_at > v_window_start;
  
  IF v_count >= p_max_count THEN
    RETURN FALSE;
  END IF;
  
  INSERT INTO public.community_rate_limits (user_id, action_type)
  VALUES (p_user_id, p_action_type);
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 8. Validate print request creation with rate limiting
CREATE OR REPLACE FUNCTION public.validate_print_request()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT public.check_rate_limit(NEW.user_id, 'print_request', 5, 60) THEN
    RAISE EXCEPTION 'لقد تجاوزت الحد المسموح من الطلبات. يرجى الانتظار قليلاً.';
  END IF;
  
  IF LENGTH(NEW.title) < 3 THEN
    RAISE EXCEPTION 'عنوان الطلب قصير جداً';
  END IF;
  
  IF LENGTH(NEW.title) > 100 THEN
    RAISE EXCEPTION 'عنوان الطلب طويل جداً';
  END IF;
  
  IF LENGTH(NEW.description) < 10 THEN
    RAISE EXCEPTION 'الوصف قصير جداً';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS validate_print_request_trigger ON community_print_requests;
CREATE TRIGGER validate_print_request_trigger
  BEFORE INSERT ON community_print_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_print_request();

-- 9. Security log for community
CREATE TABLE IF NOT EXISTS public.community_security_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action_type TEXT NOT NULL,
  target_table TEXT,
  target_id UUID,
  details JSONB,
  ip_hash TEXT,
  severity TEXT DEFAULT 'info',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.community_security_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only admins can view security logs" ON community_security_log;
CREATE POLICY "Only admins can view security logs"
  ON community_security_log FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- 10. Cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS VOID AS $$
BEGIN
  DELETE FROM public.community_rate_limits
  WHERE created_at < now() - INTERVAL '1 day';
  
  DELETE FROM public.community_security_log
  WHERE created_at < now() - INTERVAL '90 days'
    AND severity = 'info';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 11. Prevent wallet transactions deletion (audit trail)
DROP POLICY IF EXISTS "Admins can delete wallet transactions" ON wallet_transactions;

-- 12. Add immutable audit trigger
CREATE OR REPLACE FUNCTION public.prevent_audit_deletion()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'لا يمكن حذف سجلات التدقيق';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS prevent_wallet_tx_deletion ON wallet_transactions;
CREATE TRIGGER prevent_wallet_tx_deletion
  BEFORE DELETE ON wallet_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_deletion();

DROP TRIGGER IF EXISTS prevent_balance_audit_deletion ON balance_audit_log;
CREATE TRIGGER prevent_balance_audit_deletion
  BEFORE DELETE ON balance_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_deletion();
