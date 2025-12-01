-- Add telegram_chat_id to profiles table for user telegram notifications
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;

-- Create a function to prevent duplicate notifications
CREATE OR REPLACE FUNCTION public.create_notification_if_not_exists(
  p_user_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT DEFAULT 'info',
  p_related_id UUID DEFAULT NULL,
  p_is_general BOOLEAN DEFAULT FALSE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if similar notification exists in the last minute
  IF NOT EXISTS (
    SELECT 1 FROM notifications
    WHERE user_id = p_user_id
    AND title = p_title
    AND message = p_message
    AND created_at > NOW() - INTERVAL '1 minute'
  ) THEN
    INSERT INTO notifications (user_id, title, message, type, related_id, is_general)
    VALUES (p_user_id, p_title, p_message, p_type, p_related_id, p_is_general);
  END IF;
END;
$$;

-- Update notify_admins_new_order to use the deduplication function
CREATE OR REPLACE FUNCTION public.notify_admins_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_record RECORD;
  notification_message TEXT;
BEGIN
  notification_message := 'تم إنشاء طلب جديد رقم ' || NEW.order_number || ' بقيمة ' || NEW.total_amount || ' ' || NEW.currency;
  
  -- Loop through admins and create notification using deduplication function
  FOR admin_record IN SELECT DISTINCT user_id FROM public.user_roles WHERE role = 'admin'
  LOOP
    PERFORM create_notification_if_not_exists(
      admin_record.user_id,
      'طلب جديد',
      notification_message,
      'info',
      NEW.id,
      FALSE
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Update notify_order_status_change to use deduplication
CREATE OR REPLACE FUNCTION public.notify_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  notification_title TEXT;
  notification_message TEXT;
  notification_type TEXT;
BEGIN
  -- إرسال إشعار عند تغيير الحالة
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    notification_title := 'تحديث حالة الطلب';
    notification_message := CASE NEW.status
      WHEN 'confirmed' THEN 'تم تأكيد طلبك رقم ' || NEW.order_number
      WHEN 'processing' THEN 'جاري تجهيز طلبك رقم ' || NEW.order_number
      WHEN 'arrived_warehouse' THEN 'وصل طلبك رقم ' || NEW.order_number || ' إلى المخزن'
      WHEN 'shipped' THEN 'تم شحن طلبك رقم ' || NEW.order_number
      WHEN 'arrived_iraq' THEN 'وصل طلبك رقم ' || NEW.order_number || ' إلى العراق'
      WHEN 'delivered' THEN 'تم توصيل طلبك رقم ' || NEW.order_number || ' بنجاح! يرجى تأكيد الاستلام'
      WHEN 'cancelled' THEN 'تم إلغاء طلبك رقم ' || NEW.order_number
      ELSE 'تم تحديث حالة طلبك رقم ' || NEW.order_number
    END;
    notification_type := CASE NEW.status
      WHEN 'confirmed' THEN 'success'
      WHEN 'processing' THEN 'info'
      WHEN 'arrived_warehouse' THEN 'info'
      WHEN 'shipped' THEN 'info'
      WHEN 'arrived_iraq' THEN 'info'
      WHEN 'delivered' THEN 'success'
      WHEN 'cancelled' THEN 'error'
      ELSE 'info'
    END;
    
    PERFORM create_notification_if_not_exists(
      NEW.user_id,
      notification_title,
      notification_message,
      notification_type,
      NEW.id,
      FALSE
    );
  END IF;

  -- إرسال إشعار عند إضافة صورة Serial Number
  IF OLD.serial_number_image_url IS NULL AND NEW.serial_number_image_url IS NOT NULL THEN
    PERFORM create_notification_if_not_exists(
      NEW.user_id,
      'تم إضافة صورة Serial Number',
      'تم إضافة صورة Serial Number لطلبك رقم ' || NEW.order_number || '. يمكنك الآن تصدير الفاتورة',
      'info',
      NEW.id,
      FALSE
    );
  END IF;
  
  RETURN NEW;
END;
$$;