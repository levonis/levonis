
-- Strengthen the prevent_ticket_fraud function to also block direct INSERTs
CREATE OR REPLACE FUNCTION public.prevent_ticket_fraud()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow if bypass flag is set (from trusted SECURITY DEFINER functions)
  IF current_setting('app.bypass_ticket_fraud_check', true) = 'true' THEN
    RETURN NEW;
  END IF;

  -- Allow admins for both INSERT and UPDATE
  IF has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  -- Block direct INSERT (only trusted functions should insert)
  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'Unauthorized: Cannot insert ticket records directly. Use approved functions.';
  END IF;

  -- Block UPDATE that increases balance
  IF TG_OP = 'UPDATE' THEN
    IF NEW.ticket_count > OLD.ticket_count THEN
      RAISE EXCEPTION 'Unauthorized: Cannot increase ticket balance directly. Use approved functions.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop existing trigger and recreate to cover INSERT too
DROP TRIGGER IF EXISTS ticket_fraud_prevention ON public.user_tickets;

CREATE TRIGGER ticket_fraud_prevention
  BEFORE INSERT OR UPDATE ON public.user_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_ticket_fraud();
