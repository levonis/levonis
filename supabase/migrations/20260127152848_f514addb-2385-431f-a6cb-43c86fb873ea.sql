-- ============================================
-- SECURITY HARDENING: Community Profile & Merchant Dashboard
-- ============================================

-- 1. Prevent community profile tampering
CREATE OR REPLACE FUNCTION public.prevent_community_profile_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Users cannot change their own verification or suspension status
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    IF OLD.is_verified IS DISTINCT FROM NEW.is_verified THEN
      RAISE EXCEPTION 'غير مصرح لك بتغيير حالة التحقق';
    END IF;
    
    IF OLD.is_suspended IS DISTINCT FROM NEW.is_suspended THEN
      RAISE EXCEPTION 'غير مصرح لك بتغيير حالة الإيقاف';
    END IF;
    
    IF OLD.reputation_score IS DISTINCT FROM NEW.reputation_score THEN
      RAISE EXCEPTION 'غير مصرح لك بتعديل نقاط السمعة';
    END IF;
    
    IF OLD.total_spent IS DISTINCT FROM NEW.total_spent THEN
      RAISE EXCEPTION 'غير مصرح لك بتعديل إجمالي الإنفاق';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_community_profile_tampering_trigger ON community_customer_profiles;
CREATE TRIGGER prevent_community_profile_tampering_trigger
  BEFORE UPDATE ON community_customer_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_community_profile_tampering();

-- 2. Prevent merchant public profile tampering
CREATE OR REPLACE FUNCTION public.prevent_merchant_profile_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  -- Get the owner of this merchant profile
  SELECT user_id INTO v_owner_id
  FROM merchant_applications
  WHERE id = NEW.id;

  -- Only owner or admin can update
  IF auth.uid() != v_owner_id AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'غير مصرح لك بتعديل هذا الملف';
  END IF;

  -- Non-admins cannot change verification or badge tier
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    IF OLD.is_verified IS DISTINCT FROM NEW.is_verified THEN
      RAISE EXCEPTION 'غير مصرح لك بتغيير حالة التحقق';
    END IF;
    
    IF OLD.badge_tier IS DISTINCT FROM NEW.badge_tier THEN
      RAISE EXCEPTION 'غير مصرح لك بتغيير مستوى الشارة';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_merchant_profile_tampering_trigger ON merchant_public_profiles;
CREATE TRIGGER prevent_merchant_profile_tampering_trigger
  BEFORE UPDATE ON merchant_public_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_merchant_profile_tampering();

-- 3. Rate limit profile updates to prevent abuse
CREATE OR REPLACE FUNCTION public.rate_limit_profile_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recent_updates int;
BEGIN
  -- Admins bypass rate limiting
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  -- Check recent updates (max 10 per hour)
  SELECT COUNT(*) INTO v_recent_updates
  FROM community_security_log
  WHERE user_id = auth.uid()
    AND action_type = 'profile_update'
    AND created_at > NOW() - INTERVAL '1 hour';

  IF v_recent_updates >= 10 THEN
    RAISE EXCEPTION 'لقد تجاوزت الحد المسموح من التحديثات. الرجاء المحاولة لاحقاً';
  END IF;

  -- Log the update
  INSERT INTO community_security_log (user_id, action_type, target_table, target_id, severity)
  VALUES (auth.uid(), 'profile_update', TG_TABLE_NAME, NEW.id::text, 'info');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rate_limit_profile_update_trigger ON profiles;
CREATE TRIGGER rate_limit_profile_update_trigger
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.rate_limit_profile_update();

-- 4. Secure merchant application updates
CREATE OR REPLACE FUNCTION public.secure_merchant_application_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only owner or admin can update
  IF auth.uid() != OLD.user_id AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'غير مصرح لك بتعديل هذا الطلب';
  END IF;

  -- Non-admins cannot change status
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      RAISE EXCEPTION 'غير مصرح لك بتغيير حالة الطلب';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS secure_merchant_application_update_trigger ON merchant_applications;
CREATE TRIGGER secure_merchant_application_update_trigger
  BEFORE UPDATE ON merchant_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.secure_merchant_application_update();

-- 5. Prevent product price manipulation by non-owners
CREATE OR REPLACE FUNCTION public.secure_merchant_product_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  -- Get merchant owner
  SELECT user_id INTO v_owner_id
  FROM merchant_applications
  WHERE id = NEW.merchant_id;

  -- Only owner or admin can update
  IF auth.uid() != v_owner_id AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'غير مصرح لك بتعديل هذا المنتج';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS secure_merchant_product_update_trigger ON merchant_products;
CREATE TRIGGER secure_merchant_product_update_trigger
  BEFORE UPDATE ON merchant_products
  FOR EACH ROW
  EXECUTE FUNCTION public.secure_merchant_product_update();

-- 6. Secure print offer price changes after acceptance
CREATE OR REPLACE FUNCTION public.lock_accepted_offer_price()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If offer was already accepted, lock the price
  IF OLD.status = 'accepted' OR OLD.status = 'completed' THEN
    IF NOT public.has_role(auth.uid(), 'admin') THEN
      IF OLD.price_iqd IS DISTINCT FROM NEW.price_iqd THEN
        RAISE EXCEPTION 'لا يمكن تغيير السعر بعد قبول العرض';
      END IF;
      
      IF OLD.platform_fee IS DISTINCT FROM NEW.platform_fee THEN
        RAISE EXCEPTION 'لا يمكن تغيير رسوم المنصة';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lock_accepted_offer_price_trigger ON print_offers;
CREATE TRIGGER lock_accepted_offer_price_trigger
  BEFORE UPDATE ON print_offers
  FOR EACH ROW
  EXECUTE FUNCTION public.lock_accepted_offer_price();

-- 7. Add index for security log queries
CREATE INDEX IF NOT EXISTS idx_community_security_log_user_action 
ON community_security_log(user_id, action_type, created_at DESC);

-- 8. Ensure all security functions have proper search_path
-- This prevents search_path hijacking attacks

COMMENT ON FUNCTION public.prevent_community_profile_tampering IS 'Security: Prevents users from tampering with their own verification/suspension status';
COMMENT ON FUNCTION public.prevent_merchant_profile_tampering IS 'Security: Prevents unauthorized changes to merchant profiles';
COMMENT ON FUNCTION public.rate_limit_profile_update IS 'Security: Rate limits profile updates to prevent abuse';
COMMENT ON FUNCTION public.secure_merchant_application_update IS 'Security: Ensures only owners/admins can modify applications';
COMMENT ON FUNCTION public.secure_merchant_product_update IS 'Security: Ensures only merchant owners can modify their products';
COMMENT ON FUNCTION public.lock_accepted_offer_price IS 'Security: Locks offer prices after acceptance to prevent fraud';