-- إنشاء جدول رصيد النقاط للمستخدمين
CREATE TABLE IF NOT EXISTS public.user_points (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  total_points NUMERIC NOT NULL DEFAULT 0,
  available_points NUMERIC NOT NULL DEFAULT 0,
  redeemed_points NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- إنشاء جدول معاملات النقاط
CREATE TABLE IF NOT EXISTS public.points_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points NUMERIC NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('earned', 'redeemed', 'converted')),
  source TEXT NOT NULL CHECK (source IN ('order', 'review', 'coupon', 'cash')),
  related_id UUID,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- تفعيل RLS
ALTER TABLE public.user_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.points_transactions ENABLE ROW LEVEL SECURITY;

-- سياسات RLS لجدول user_points
CREATE POLICY "Users can view their own points"
ON public.user_points
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own points"
ON public.user_points
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all points"
ON public.user_points
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert user points"
ON public.user_points
FOR INSERT
WITH CHECK (true);

-- سياسات RLS لجدول points_transactions
CREATE POLICY "Users can view their own transactions"
ON public.points_transactions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all transactions"
ON public.points_transactions
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert transactions"
ON public.points_transactions
FOR INSERT
WITH CHECK (true);

-- إنشاء فهارس للأداء
CREATE INDEX IF NOT EXISTS idx_user_points_user_id ON public.user_points(user_id);
CREATE INDEX IF NOT EXISTS idx_points_transactions_user_id ON public.points_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_points_transactions_type ON public.points_transactions(type);
CREATE INDEX IF NOT EXISTS idx_points_transactions_source ON public.points_transactions(source);

-- trigger لتحديث updated_at
CREATE TRIGGER update_user_points_updated_at
BEFORE UPDATE ON public.user_points
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- دالة لإضافة نقاط عند تسليم الطلب
CREATE OR REPLACE FUNCTION public.award_points_on_delivery()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  points_per_order NUMERIC;
  user_points_record RECORD;
BEGIN
  -- التحقق من تغيير الحالة إلى delivered
  IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
    -- الحصول على عدد النقاط من الإعدادات
    SELECT (setting_value->>'points_per_order')::NUMERIC INTO points_per_order
    FROM public.default_settings
    WHERE setting_key = 'points_settings';
    
    -- إذا لم توجد إعدادات، استخدم 10 نقاط افتراضياً
    IF points_per_order IS NULL THEN
      points_per_order := 10;
    END IF;
    
    -- التحقق من وجود سجل نقاط للمستخدم
    SELECT * INTO user_points_record
    FROM public.user_points
    WHERE user_id = NEW.user_id;
    
    -- إنشاء سجل إذا لم يكن موجوداً
    IF user_points_record IS NULL THEN
      INSERT INTO public.user_points (user_id, total_points, available_points)
      VALUES (NEW.user_id, points_per_order, points_per_order);
    ELSE
      -- تحديث النقاط
      UPDATE public.user_points
      SET total_points = total_points + points_per_order,
          available_points = available_points + points_per_order
      WHERE user_id = NEW.user_id;
    END IF;
    
    -- إضافة معاملة
    INSERT INTO public.points_transactions (user_id, points, type, source, related_id, description)
    VALUES (
      NEW.user_id,
      points_per_order,
      'earned',
      'order',
      NEW.id,
      'نقاط الشراء من الطلب رقم ' || NEW.order_number
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- دالة لإضافة نقاط عند كتابة تقييم
CREATE OR REPLACE FUNCTION public.award_points_on_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  points_per_review NUMERIC;
  user_points_record RECORD;
BEGIN
  -- الحصول على عدد النقاط من الإعدادات
  SELECT (setting_value->>'points_per_review')::NUMERIC INTO points_per_review
  FROM public.default_settings
  WHERE setting_key = 'points_settings';
  
  -- إذا لم توجد إعدادات، استخدم 5 نقاط افتراضياً
  IF points_per_review IS NULL THEN
    points_per_review := 5;
  END IF;
  
  -- التحقق من وجود سجل نقاط للمستخدم
  SELECT * INTO user_points_record
  FROM public.user_points
  WHERE user_id = NEW.user_id;
  
  -- إنشاء سجل إذا لم يكن موجوداً
  IF user_points_record IS NULL THEN
    INSERT INTO public.user_points (user_id, total_points, available_points)
    VALUES (NEW.user_id, points_per_review, points_per_review);
  ELSE
    -- تحديث النقاط
    UPDATE public.user_points
    SET total_points = total_points + points_per_review,
        available_points = available_points + points_per_review
    WHERE user_id = NEW.user_id;
  END IF;
  
  -- إضافة معاملة
  INSERT INTO public.points_transactions (user_id, points, type, source, related_id, description)
  VALUES (
    NEW.user_id,
    points_per_review,
    'earned',
    'review',
    NEW.id,
    'نقاط التقييم'
  );
  
  RETURN NEW;
END;
$$;

-- إنشاء triggers
DROP TRIGGER IF EXISTS award_points_on_order_delivery ON public.orders;
CREATE TRIGGER award_points_on_order_delivery
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.award_points_on_delivery();

DROP TRIGGER IF EXISTS award_points_on_new_review ON public.reviews;
CREATE TRIGGER award_points_on_new_review
AFTER INSERT ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.award_points_on_review();