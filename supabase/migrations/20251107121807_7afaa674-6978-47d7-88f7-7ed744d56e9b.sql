-- إنشاء جدول الطلبات مع معلومات التتبع
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')),
  total_amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'دينار عراقي',
  
  -- معلومات الشحن
  shipping_address TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  governorate TEXT NOT NULL,
  
  -- معلومات التتبع
  tracking_number TEXT,
  tracking_url TEXT,
  shipping_company TEXT,
  shipping_notes TEXT,
  
  -- التواريخ
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  shipped_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE
);

-- إنشاء فهرس للبحث السريع
CREATE INDEX idx_orders_user_id ON public.orders(user_id);
CREATE INDEX idx_orders_order_number ON public.orders(order_number);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_tracking_number ON public.orders(tracking_number);

-- تفعيل RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- السماح للمستخدمين بعرض طلباتهم الخاصة
CREATE POLICY "Users can view their own orders"
ON public.orders
FOR SELECT
USING (auth.uid() = user_id);

-- السماح للمستخدمين بإنشاء طلبات جديدة
CREATE POLICY "Users can create their own orders"
ON public.orders
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- السماح للإدارة بعرض جميع الطلبات
CREATE POLICY "Admins can view all orders"
ON public.orders
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- السماح للإدارة بتحديث جميع الطلبات
CREATE POLICY "Admins can update all orders"
ON public.orders
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- إنشاء جدول عناصر الطلب
CREATE TABLE public.order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  product_option_id UUID REFERENCES public.product_options(id) ON DELETE SET NULL,
  
  product_name TEXT NOT NULL,
  product_name_ar TEXT NOT NULL,
  selected_option TEXT,
  selected_color TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,
  total_price NUMERIC(10,2) NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- إنشاء فهرس
CREATE INDEX idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX idx_order_items_product_id ON public.order_items(product_id);

-- تفعيل RLS
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- السماح للمستخدمين بعرض عناصر طلباتهم
CREATE POLICY "Users can view their own order items"
ON public.order_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = order_items.order_id
    AND orders.user_id = auth.uid()
  )
);

-- السماح للمستخدمين بإنشاء عناصر طلب جديدة
CREATE POLICY "Users can create order items for their orders"
ON public.order_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = order_items.order_id
    AND orders.user_id = auth.uid()
  )
);

-- السماح للإدارة بعرض جميع عناصر الطلبات
CREATE POLICY "Admins can view all order items"
ON public.order_items
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- دالة لتوليد رقم طلب فريد
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_number TEXT;
  number_exists BOOLEAN;
BEGIN
  LOOP
    new_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    SELECT EXISTS(SELECT 1 FROM orders WHERE order_number = new_number) INTO number_exists;
    EXIT WHEN NOT number_exists;
  END LOOP;
  RETURN new_number;
END;
$$;

-- دالة لتحديث وقت التحديث تلقائياً
CREATE TRIGGER update_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- دالة لإرسال إشعار عند تحديث حالة الطلب
CREATE OR REPLACE FUNCTION notify_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
        WHEN 'shipped' THEN 'تم شحن طلبك رقم ' || NEW.order_number || CASE WHEN NEW.tracking_number IS NOT NULL THEN ' - رقم التتبع: ' || NEW.tracking_number ELSE '' END
        WHEN 'delivered' THEN 'تم توصيل طلبك رقم ' || NEW.order_number || ' بنجاح!'
        WHEN 'cancelled' THEN 'تم إلغاء طلبك رقم ' || NEW.order_number
        ELSE 'تم تحديث حالة طلبك رقم ' || NEW.order_number
      END,
      CASE NEW.status
        WHEN 'confirmed' THEN 'success'
        WHEN 'processing' THEN 'info'
        WHEN 'shipped' THEN 'info'
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
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER order_status_change_notification
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION notify_order_status_change();