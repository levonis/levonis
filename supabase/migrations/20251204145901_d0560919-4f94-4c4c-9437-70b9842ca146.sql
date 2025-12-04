-- Update the notify_order_status_change function to include estimated delivery date notification
CREATE OR REPLACE FUNCTION public.notify_order_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  notification_title TEXT;
  notification_message TEXT;
  notification_type TEXT;
  formatted_date TEXT;
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

  -- إرسال إشعار عند تحديث التاريخ المتوقع للوصول
  IF OLD.estimated_delivery_date IS DISTINCT FROM NEW.estimated_delivery_date AND NEW.estimated_delivery_date IS NOT NULL THEN
    formatted_date := TO_CHAR(NEW.estimated_delivery_date, 'YYYY-MM-DD');
    
    PERFORM create_notification_if_not_exists(
      NEW.user_id,
      'تحديث موعد الوصول المتوقع',
      'تم تحديث التاريخ المتوقع لوصول طلبك رقم ' || NEW.order_number || ' إلى ' || formatted_date,
      'info',
      NEW.id,
      FALSE
    );
  END IF;
  
  RETURN NEW;
END;
$function$;