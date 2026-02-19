-- Drop the old conflicting trigger that blocks ALL status changes for non-admins
DROP TRIGGER IF EXISTS secure_merchant_application_update_trigger ON merchant_applications;

-- Update the validate function to handle both security and the draft->pending allowance
CREATE OR REPLACE FUNCTION public.validate_merchant_application_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Only owner or admin can update
  IF auth.uid() != OLD.user_id AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'غير مصرح لك بتعديل هذا الطلب';
  END IF;

  IF NOT public.has_role(auth.uid(), 'admin') THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      -- Allow user to submit their own application: draft -> pending, or rejected -> pending
      IF (OLD.status = 'draft' OR OLD.status = 'rejected') AND NEW.status = 'pending' AND auth.uid() = OLD.user_id THEN
        NULL; -- allowed
      ELSE
        RAISE EXCEPTION 'غير مصرح لك بتغيير حالة الطلب';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS validate_merchant_application_update_trigger ON merchant_applications;
CREATE TRIGGER validate_merchant_application_update_trigger
  BEFORE UPDATE ON merchant_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_merchant_application_update();