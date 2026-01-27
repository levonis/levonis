-- Fix SECURITY DEFINER functions without search_path

-- 1. ensure_single_default_address
CREATE OR REPLACE FUNCTION public.ensure_single_default_address()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.user_addresses
    SET is_default = false
    WHERE user_id = NEW.user_id AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- 2. delete_old_notifications
CREATE OR REPLACE FUNCTION public.delete_old_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.notifications
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$;

-- 3. generate_listing_code
CREATE OR REPLACE FUNCTION public.generate_listing_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    new_code := 'PRD-' || LPAD(FLOOR(RANDOM() * 999999)::TEXT, 6, '0');
    SELECT EXISTS(SELECT 1 FROM user_listings WHERE listing_code = new_code) INTO code_exists;
    EXIT WHEN NOT code_exists;
  END LOOP;
  RETURN new_code;
END;
$$;

-- 4. generate_cart_code
CREATE OR REPLACE FUNCTION public.generate_cart_code()
RETURNS VARCHAR(20)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_code VARCHAR(20);
    code_exists BOOLEAN;
BEGIN
    LOOP
        new_code := 'CART-' || LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
        SELECT EXISTS(SELECT 1 FROM public.cart_requests WHERE cart_code = new_code) INTO code_exists;
        EXIT WHEN NOT code_exists;
    END LOOP;
    RETURN new_code;
END;
$$;

-- 5. audit_wallet_changes
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

-- 6. audit_ticket_changes
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

-- 7. sync_merchant_badges_to_profile
CREATE OR REPLACE FUNCTION public.sync_merchant_badges_to_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.merchant_public_profiles
  SET 
    is_verified = NEW.is_verified,
    badge_tier = NEW.badge_tier
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;