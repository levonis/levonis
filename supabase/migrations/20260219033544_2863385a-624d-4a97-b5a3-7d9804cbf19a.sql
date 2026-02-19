-- Fix merchant_applications trigger to allow users to submit their own application (draft -> pending)
CREATE OR REPLACE FUNCTION public.validate_merchant_application_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      -- Allow user to submit their own application: draft -> pending
      IF OLD.status = 'draft' AND NEW.status = 'pending' AND auth.uid() = OLD.user_id THEN
        -- This is allowed
        NULL;
      ELSE
        RAISE EXCEPTION 'غير مصرح لك بتغيير حالة الطلب';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;