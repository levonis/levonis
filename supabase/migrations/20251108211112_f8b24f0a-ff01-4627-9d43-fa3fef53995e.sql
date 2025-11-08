-- Function لإرسال إشعار لجميع الأدمن
CREATE OR REPLACE FUNCTION public.notify_admins_new_order()
RETURNS TRIGGER AS $$
BEGIN
  -- إرسال إشعار لجميع الأدمن
  INSERT INTO public.notifications (user_id, title, message, type, related_id)
  SELECT 
    ur.user_id,
    'طلب جديد',
    'تم إنشاء طلب جديد رقم ' || NEW.order_number || ' بقيمة ' || NEW.total_amount || ' ' || NEW.currency,
    'info',
    NEW.id
  FROM public.user_roles ur
  WHERE ur.role = 'admin';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger لإشعار الأدمن عند إنشاء طلب جديد
DROP TRIGGER IF EXISTS trigger_notify_admins_new_order ON public.orders;
CREATE TRIGGER trigger_notify_admins_new_order
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admins_new_order();