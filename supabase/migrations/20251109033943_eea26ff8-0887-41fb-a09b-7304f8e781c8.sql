-- إضافة username و avatar_url للمستخدمين
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS username TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- إنشاء فهرس على username للبحث السريع
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

-- إضافة أعمدة لمعلومات الشحن والخيار في cart_items
ALTER TABLE public.cart_items
ADD COLUMN IF NOT EXISTS shipping_option_index INTEGER,
ADD COLUMN IF NOT EXISTS shipping_option_name_ar TEXT;

-- إضافة أعمدة لمعلومات الشحن في order_items
ALTER TABLE public.order_items
ADD COLUMN IF NOT EXISTS shipping_option_name_ar TEXT,
ADD COLUMN IF NOT EXISTS shipping_price_adjustment NUMERIC DEFAULT 0;

-- إنشاء جدول التقييمات والمراجعات
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);

-- تفعيل RLS على جدول المراجعات
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- السماح للجميع بقراءة المراجعات
CREATE POLICY "Anyone can view reviews"
ON public.reviews
FOR SELECT
USING (true);

-- السماح للمستخدمين بإنشاء مراجعاتهم الخاصة
CREATE POLICY "Users can create their own reviews"
ON public.reviews
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- السماح للمستخدمين بتحديث مراجعاتهم الخاصة
CREATE POLICY "Users can update their own reviews"
ON public.reviews
FOR UPDATE
USING (auth.uid() = user_id);

-- السماح للمستخدمين بحذف مراجعاتهم الخاصة
CREATE POLICY "Users can delete their own reviews"
ON public.reviews
FOR DELETE
USING (auth.uid() = user_id);

-- السماح للأدمن بحذف أي مراجعة
CREATE POLICY "Admins can delete any review"
ON public.reviews
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- إنشاء trigger لتحديث updated_at في reviews
CREATE TRIGGER update_reviews_updated_at
BEFORE UPDATE ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- إنشاء فهرس على product_id للاستعلامات السريعة
CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON public.reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON public.reviews(user_id);