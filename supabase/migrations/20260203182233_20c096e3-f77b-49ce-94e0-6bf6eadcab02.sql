-- Fix the trigger function to use correct column names
CREATE OR REPLACE FUNCTION prevent_order_price_manipulation()
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
      IF NEW.total_amount IS DISTINCT FROM OLD.total_amount OR
         NEW.subtotal IS DISTINCT FROM OLD.subtotal OR
         NEW.discount_amount IS DISTINCT FROM OLD.discount_amount THEN
        RAISE EXCEPTION 'غير مصرح لك بتعديل الأسعار';
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;