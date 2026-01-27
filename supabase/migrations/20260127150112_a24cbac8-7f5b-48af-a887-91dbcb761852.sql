-- Fix search_path for audit functions
CREATE OR REPLACE FUNCTION public.audit_ticket_changes_v2()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.audit_wallet_changes_v2()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;