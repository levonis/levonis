-- Drop the trigger first
DROP TRIGGER IF EXISTS notify_order_status_change_trigger ON public.orders;

-- Update the trigger function to remove tracking_number dependency
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
        WHEN 'shipped' THEN 'تم شحن طلبك رقم ' || NEW.order_number
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

-- Recreate the trigger
CREATE TRIGGER notify_order_status_change_trigger
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_order_status_change();

-- Now remove shipping tracking columns
ALTER TABLE public.orders 
DROP COLUMN IF EXISTS shipping_company,
DROP COLUMN IF EXISTS tracking_number,
DROP COLUMN IF EXISTS tracking_url;

-- Add tax and payment detail columns
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS subtotal numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax_percentage numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS paid_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS remaining_amount numeric DEFAULT 0;