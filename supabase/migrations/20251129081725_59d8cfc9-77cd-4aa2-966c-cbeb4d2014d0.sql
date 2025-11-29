-- Fix search_path for notify_payment_status_change function
CREATE OR REPLACE FUNCTION public.notify_payment_status_change()
RETURNS TRIGGER AS $$
DECLARE
  payment_status_ar TEXT;
BEGIN
  -- Only trigger if payment_status changed
  IF OLD.payment_status IS DISTINCT FROM NEW.payment_status THEN
    -- Get Arabic text for payment status
    payment_status_ar := CASE NEW.payment_status
      WHEN 'paid' THEN 'مدفوع'
      WHEN 'partial' THEN 'مدفوع جزئياً'
      WHEN 'refunded' THEN 'مسترجع'
      WHEN 'pending' THEN 'قيد الانتظار'
      ELSE NEW.payment_status
    END;

    -- Insert notification for the user
    INSERT INTO public.notifications (
      user_id,
      title,
      message,
      type,
      related_id,
      is_general
    ) VALUES (
      NEW.user_id,
      'تحديث حالة الدفع',
      'تم تحديث حالة الدفع للطلب رقم ' || NEW.order_number || ' إلى: ' || payment_status_ar,
      'payment',
      NEW.id,
      false
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;