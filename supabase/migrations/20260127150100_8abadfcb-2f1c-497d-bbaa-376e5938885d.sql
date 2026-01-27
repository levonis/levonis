-- Fix the trigger - using correct column names
DROP TRIGGER IF EXISTS ultra_audit_tickets ON user_tickets;
DROP TRIGGER IF EXISTS ultra_audit_wallets ON user_wallets;

-- Enhanced audit trigger for tickets
CREATE OR REPLACE FUNCTION public.audit_ticket_changes_v2()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO balance_audit_log (
    user_id, table_name, operation, old_balance, new_balance, 
    change_amount, function_name, created_at
  )
  VALUES (
    COALESCE(NEW.user_id, OLD.user_id),
    'user_tickets',
    TG_OP,
    OLD.ticket_count,
    NEW.ticket_count,
    NEW.ticket_count - COALESCE(OLD.ticket_count, 0),
    COALESCE(current_setting('app.current_function', true), 'unknown'),
    NOW()
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enhanced audit trigger for wallets  
CREATE OR REPLACE FUNCTION public.audit_wallet_changes_v2()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO balance_audit_log (
    user_id, table_name, operation, old_balance, new_balance, 
    change_amount, function_name, created_at
  )
  VALUES (
    COALESCE(NEW.user_id, OLD.user_id),
    'user_wallets',
    TG_OP,
    OLD.balance::INTEGER,
    NEW.balance::INTEGER,
    NEW.balance::INTEGER - COALESCE(OLD.balance, 0)::INTEGER,
    COALESCE(current_setting('app.current_function', true), 'unknown'),
    NOW()
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply triggers
CREATE TRIGGER audit_tickets_v2
  AFTER UPDATE ON user_tickets
  FOR EACH ROW
  EXECUTE FUNCTION audit_ticket_changes_v2();

CREATE TRIGGER audit_wallets_v2
  AFTER UPDATE ON user_wallets
  FOR EACH ROW
  EXECUTE FUNCTION audit_wallet_changes_v2();

-- Drop old problematic function
DROP FUNCTION IF EXISTS public.ultra_secure_balance_trigger();