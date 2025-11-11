-- Update notification function to include new statuses
CREATE OR REPLACE FUNCTION public.notify_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- إرسال إشعار عند تغيير الحالة
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.notifications (user_id, title, message, type, related_id)
    VALUES (
      NEW.user_id,
      'تحديث حالة الطلب',
      CASE NEW.status
        WHEN 'confirmed' THEN 'تم تأكيد طلبك رقم ' || NEW.order_number
        WHEN 'processing' THEN 'جاري تجهيز طلبك رقم ' || NEW.order_number
        WHEN 'arrived_warehouse' THEN 'وصل طلبك رقم ' || NEW.order_number || ' إلى المخزن'
        WHEN 'shipped' THEN 'تم شحن طلبك رقم ' || NEW.order_number || CASE WHEN NEW.tracking_number IS NOT NULL THEN ' - رقم التتبع: ' || NEW.tracking_number ELSE '' END
        WHEN 'arrived_iraq' THEN 'وصل طلبك رقم ' || NEW.order_number || ' إلى العراق'
        WHEN 'delivered' THEN 'تم توصيل طلبك رقم ' || NEW.order_number || ' بنجاح! يرجى تأكيد الاستلام'
        WHEN 'cancelled' THEN 'تم إلغاء طلبك رقم ' || NEW.order_number
        ELSE 'تم تحديث حالة طلبك رقم ' || NEW.order_number
      END,
      CASE NEW.status
        WHEN 'confirmed' THEN 'success'
        WHEN 'processing' THEN 'info'
        WHEN 'arrived_warehouse' THEN 'info'
        WHEN 'shipped' THEN 'info'
        WHEN 'arrived_iraq' THEN 'info'
        WHEN 'delivered' THEN 'success'
        WHEN 'cancelled' THEN 'error'
        ELSE 'info'
      END,
      NEW.id
    );
  END IF;
  
  -- إرسال إشعار عند إضافة رقم تتبع
  IF OLD.tracking_number IS NULL AND NEW.tracking_number IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, related_id)
    VALUES (
      NEW.user_id,
      'تم إضافة رقم التتبع',
      'تم إضافة رقم التتبع لطلبك رقم ' || NEW.order_number || ': ' || NEW.tracking_number,
      'info',
      NEW.id
    );
  END IF;

  -- إرسال إشعار عند إضافة صورة Serial Number
  IF OLD.serial_number_image_url IS NULL AND NEW.serial_number_image_url IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, related_id)
    VALUES (
      NEW.user_id,
      'تم إضافة صورة Serial Number',
      'تم إضافة صورة Serial Number لطلبك رقم ' || NEW.order_number || '. يمكنك الآن تصدير الفاتورة',
      'info',
      NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$function$;