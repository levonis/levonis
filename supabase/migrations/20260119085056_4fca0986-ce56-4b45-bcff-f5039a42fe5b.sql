-- جدول قسائم النقاط القابلة للشراء
CREATE TABLE IF NOT EXISTS public.points_redeemable_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title_ar TEXT NOT NULL,
  description_ar TEXT,
  product_type TEXT NOT NULL DEFAULT 'coupon', -- coupon, free_shipping, discount
  value_amount NUMERIC NOT NULL DEFAULT 0, -- قيمة الخصم بالدينار
  points_cost INTEGER NOT NULL, -- كم نقطة مطلوبة للشراء
  stock_quantity INTEGER DEFAULT 0, -- المخزون المتاح
  max_per_user INTEGER DEFAULT 1, -- الحد الأقصى لكل مستخدم في العرض الواحد
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  valid_days INTEGER DEFAULT 30, -- صلاحية القسيمة بالأيام بعد الشراء
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- جدول مشتريات المستخدمين للقسائم
CREATE TABLE IF NOT EXISTS public.user_redeemed_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.points_redeemable_products(id) ON DELETE CASCADE,
  coupon_code TEXT NOT NULL,
  points_spent INTEGER NOT NULL,
  is_used BOOLEAN DEFAULT false,
  used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- جدول طلبات مشاركة الانستجرام (للتأكيد)
CREATE TABLE IF NOT EXISTS public.instagram_share_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  product_id UUID,
  image_url TEXT NOT NULL,
  instagram_username TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  admin_notes TEXT,
  points_awarded INTEGER DEFAULT 0,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- تعديل جدول المهام اليومية لإضافة حقول إضافية
ALTER TABLE public.daily_tasks 
ADD COLUMN IF NOT EXISTS streak_bonus_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS streak_bonus_per_day NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_streak_days INTEGER DEFAULT 7,
ADD COLUMN IF NOT EXISTS requires_confirmation BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS confirmation_type TEXT DEFAULT 'auto'; -- auto, image_upload, admin_approval

-- تفعيل RLS
ALTER TABLE public.points_redeemable_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_redeemed_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_share_submissions ENABLE ROW LEVEL SECURITY;

-- سياسات RLS للقسائم القابلة للشراء
CREATE POLICY "Anyone can view active redeemable products"
ON public.points_redeemable_products FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage redeemable products"
ON public.points_redeemable_products FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- سياسات RLS لمشتريات المستخدمين
CREATE POLICY "Users can view their own redeemed products"
ON public.user_redeemed_products FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own redemptions"
ON public.user_redeemed_products FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all redemptions"
ON public.user_redeemed_products FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- سياسات RLS لطلبات مشاركة الانستجرام
CREATE POLICY "Users can view their own submissions"
ON public.instagram_share_submissions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create submissions"
ON public.instagram_share_submissions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all submissions"
ON public.instagram_share_submissions FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- فهارس للأداء
CREATE INDEX IF NOT EXISTS idx_redeemable_products_active ON public.points_redeemable_products(is_active);
CREATE INDEX IF NOT EXISTS idx_user_redeemed_products_user ON public.user_redeemed_products(user_id);
CREATE INDEX IF NOT EXISTS idx_user_redeemed_products_code ON public.user_redeemed_products(coupon_code);
CREATE INDEX IF NOT EXISTS idx_instagram_submissions_status ON public.instagram_share_submissions(status);
CREATE INDEX IF NOT EXISTS idx_instagram_submissions_user ON public.instagram_share_submissions(user_id);