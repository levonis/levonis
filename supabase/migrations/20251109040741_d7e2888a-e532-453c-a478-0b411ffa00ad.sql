-- إضافة عمود المستوى في جدول النقاط
ALTER TABLE public.user_points
ADD COLUMN IF NOT EXISTS level TEXT DEFAULT 'bronze' CHECK (level IN ('bronze', 'silver', 'gold', 'platinum'));

-- إنشاء جدول تعريف المستويات والمزايا
CREATE TABLE IF NOT EXISTS public.loyalty_levels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  level_key TEXT NOT NULL UNIQUE CHECK (level_key IN ('bronze', 'silver', 'gold', 'platinum')),
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  min_points NUMERIC NOT NULL DEFAULT 0,
  color TEXT NOT NULL,
  icon TEXT,
  benefits JSONB NOT NULL DEFAULT '[]'::jsonb,
  discount_percentage NUMERIC DEFAULT 0,
  bonus_points_percentage NUMERIC DEFAULT 0,
  free_shipping BOOLEAN DEFAULT false,
  display_order INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- تفعيل RLS
ALTER TABLE public.loyalty_levels ENABLE ROW LEVEL SECURITY;

-- سياسات RLS لجدول loyalty_levels
CREATE POLICY "Anyone can view loyalty levels"
ON public.loyalty_levels
FOR SELECT
USING (true);

CREATE POLICY "Only admins can manage loyalty levels"
ON public.loyalty_levels
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- إدراج المستويات الافتراضية
INSERT INTO public.loyalty_levels (level_key, name_ar, name_en, min_points, color, display_order, benefits, discount_percentage, bonus_points_percentage, free_shipping)
VALUES 
  ('bronze', 'برونزي', 'Bronze', 0, '#CD7F32', 1, 
   '[{"text_ar": "كسب نقاط على المشتريات", "text_en": "Earn points on purchases"}, {"text_ar": "تقييم المنتجات", "text_en": "Review products"}]'::jsonb,
   0, 0, false),
  ('silver', 'فضي', 'Silver', 500, '#C0C0C0', 2,
   '[{"text_ar": "كسب نقاط على المشتريات", "text_en": "Earn points on purchases"}, {"text_ar": "خصم 5% على جميع المشتريات", "text_en": "5% discount on all purchases"}, {"text_ar": "نقاط إضافية 10%", "text_en": "10% bonus points"}]'::jsonb,
   5, 10, false),
  ('gold', 'ذهبي', 'Gold', 1500, '#FFD700', 3,
   '[{"text_ar": "كسب نقاط على المشتريات", "text_en": "Earn points on purchases"}, {"text_ar": "خصم 10% على جميع المشتريات", "text_en": "10% discount on all purchases"}, {"text_ar": "نقاط إضافية 25%", "text_en": "25% bonus points"}, {"text_ar": "شحن مجاني على الطلبات", "text_en": "Free shipping on orders"}]'::jsonb,
   10, 25, true),
  ('platinum', 'بلاتيني', 'Platinum', 5000, '#E5E4E2', 4,
   '[{"text_ar": "كسب نقاط على المشتريات", "text_en": "Earn points on purchases"}, {"text_ar": "خصم 15% على جميع المشتريات", "text_en": "15% discount on all purchases"}, {"text_ar": "نقاط إضافية 50%", "text_en": "50% bonus points"}, {"text_ar": "شحن مجاني على جميع الطلبات", "text_en": "Free shipping on all orders"}, {"text_ar": "دعم فني مخصص", "text_en": "Priority customer support"}]'::jsonb,
   15, 50, true)
ON CONFLICT (level_key) DO NOTHING;

-- دالة لحساب المستوى بناءً على النقاط
CREATE OR REPLACE FUNCTION public.calculate_user_level(points NUMERIC)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT level_key
  FROM public.loyalty_levels
  WHERE min_points <= points
  ORDER BY min_points DESC
  LIMIT 1
$$;

-- دالة لتحديث مستوى المستخدم تلقائياً
CREATE OR REPLACE FUNCTION public.update_user_level()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_level TEXT;
  old_level TEXT;
  level_info RECORD;
BEGIN
  -- حساب المستوى الجديد
  new_level := calculate_user_level(NEW.total_points);
  old_level := OLD.level;
  
  -- تحديث المستوى إذا تغير
  IF new_level != old_level THEN
    NEW.level := new_level;
    
    -- الحصول على معلومات المستوى الجديد
    SELECT name_ar INTO level_info
    FROM public.loyalty_levels
    WHERE level_key = new_level;
    
    -- إرسال إشعار للمستخدم
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      NEW.user_id,
      'تهانينا! 🎉',
      'لقد تمت ترقيتك إلى مستوى ' || level_info.name_ar || '! استمتع بالمزايا الجديدة.',
      'success'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- trigger لتحديث المستوى عند تغيير النقاط
DROP TRIGGER IF EXISTS update_level_on_points_change ON public.user_points;
CREATE TRIGGER update_level_on_points_change
BEFORE UPDATE ON public.user_points
FOR EACH ROW
WHEN (OLD.total_points IS DISTINCT FROM NEW.total_points)
EXECUTE FUNCTION public.update_user_level();

-- trigger لتحديث updated_at
CREATE TRIGGER update_loyalty_levels_updated_at
BEFORE UPDATE ON public.loyalty_levels
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- تحديث المستويات الحالية للمستخدمين
UPDATE public.user_points
SET level = calculate_user_level(total_points)
WHERE level IS NULL OR level = 'bronze';

-- إنشاء فهرس على المستوى للأداء
CREATE INDEX IF NOT EXISTS idx_user_points_level ON public.user_points(level);
CREATE INDEX IF NOT EXISTS idx_loyalty_levels_min_points ON public.loyalty_levels(min_points);