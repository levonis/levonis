-- =====================================================
-- تحويل نظام المسابقات إلى نظام شراء منتجات مع هدايا
-- =====================================================

-- 1) جدول المنتجات المشتراة من المسابقات
CREATE TABLE public.user_purchased_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  product_id UUID REFERENCES public.products(id),
  competition_id UUID REFERENCES public.competitions(id),
  -- معلومات المنتج عند الشراء
  product_name TEXT NOT NULL,
  product_name_ar TEXT NOT NULL,
  product_image TEXT,
  product_price NUMERIC NOT NULL DEFAULT 0,
  -- التذاكر الهدية
  gift_tickets INTEGER NOT NULL DEFAULT 0,
  -- نوع الحصول على المنتج
  source_type TEXT NOT NULL DEFAULT 'purchase' CHECK (source_type IN ('purchase', 'prize', 'gift')),
  -- حالة الطلب
  order_status TEXT NOT NULL DEFAULT 'not_ordered' CHECK (order_status IN ('not_ordered', 'ordered', 'shipped', 'delivered', 'cancelled')),
  -- ربط بالطلب إن وجد
  order_id UUID REFERENCES public.orders(id),
  -- تم عرضه في السوق المستعمل
  listed_in_marketplace BOOLEAN DEFAULT false,
  marketplace_listing_id UUID REFERENCES public.user_listings(id),
  -- العملة
  currency TEXT DEFAULT 'دينار',
  -- التواريخ
  purchased_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ordered_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2) تمكين RLS
ALTER TABLE public.user_purchased_products ENABLE ROW LEVEL SECURITY;

-- 3) سياسات الأمان
CREATE POLICY "Users can view their own purchased products"
ON public.user_purchased_products FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own purchased products"
ON public.user_purchased_products FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own purchased products"
ON public.user_purchased_products FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all purchased products"
ON public.user_purchased_products FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage all purchased products"
ON public.user_purchased_products FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Require authentication for purchased products"
ON public.user_purchased_products FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- 4) فهارس للأداء
CREATE INDEX idx_user_purchased_products_user_id ON public.user_purchased_products(user_id);
CREATE INDEX idx_user_purchased_products_order_status ON public.user_purchased_products(order_status);
CREATE INDEX idx_user_purchased_products_source_type ON public.user_purchased_products(source_type);
CREATE INDEX idx_user_purchased_products_competition_id ON public.user_purchased_products(competition_id);

-- 5) إضافة حقول جديدة لجدول المسابقات لدعم النظام الجديد
ALTER TABLE public.competitions ADD COLUMN IF NOT EXISTS is_product_based BOOLEAN DEFAULT true;
ALTER TABLE public.competitions ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id);
ALTER TABLE public.competitions ADD COLUMN IF NOT EXISTS gift_tickets_per_purchase INTEGER DEFAULT 1;
ALTER TABLE public.competitions ADD COLUMN IF NOT EXISTS legal_disclaimer TEXT DEFAULT 'الشراء يتم على منتجات حقيقية، والتذاكر هدية مجانية مع كل عملية شراء.';

-- 6) دالة لشراء منتج وإضافته للمستخدم مع التذاكر الهدية
CREATE OR REPLACE FUNCTION public.purchase_product_with_gift_tickets(
  p_competition_id UUID,
  p_quantity INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id UUID;
  comp_record RECORD;
  product_record RECORD;
  user_wallet_balance NUMERIC;
  total_cost NUMERIC;
  total_gift_tickets INTEGER;
  new_purchased_product_id UUID;
  i INTEGER;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'غير مصرح');
  END IF;

  IF p_quantity < 1 OR p_quantity > 100 THEN
    RETURN jsonb_build_object('success', false, 'error', 'الكمية يجب أن تكون بين 1 و 100');
  END IF;

  -- جلب بيانات المسابقة/المنتج
  SELECT * INTO comp_record
  FROM competitions
  WHERE id = p_competition_id AND status = 'active';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'المنتج غير متاح');
  END IF;

  -- جلب بيانات المنتج المرتبط
  IF comp_record.product_id IS NOT NULL THEN
    SELECT * INTO product_record FROM products WHERE id = comp_record.product_id;
  END IF;

  -- حساب التكلفة الإجمالية
  total_cost := comp_record.ticket_price * p_quantity;
  total_gift_tickets := COALESCE(comp_record.gift_tickets_per_purchase, 1) * p_quantity;

  -- التحقق من رصيد المحفظة
  SELECT balance INTO user_wallet_balance
  FROM user_wallets
  WHERE user_id = current_user_id;
  
  IF user_wallet_balance IS NULL OR user_wallet_balance < total_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'رصيد المحفظة غير كافٍ. المطلوب: ' || total_cost);
  END IF;

  -- خصم من المحفظة
  UPDATE user_wallets
  SET balance = balance - total_cost,
      updated_at = now()
  WHERE user_id = current_user_id;
  
  -- تسجيل معاملة المحفظة
  INSERT INTO wallet_transactions (user_id, type, amount, status)
  VALUES (current_user_id, 'product_purchase', -total_cost, 'completed');

  -- إضافة المنتجات المشتراة
  FOR i IN 1..p_quantity LOOP
    INSERT INTO user_purchased_products (
      user_id,
      product_id,
      competition_id,
      product_name,
      product_name_ar,
      product_image,
      product_price,
      gift_tickets,
      source_type,
      currency
    )
    VALUES (
      current_user_id,
      comp_record.product_id,
      p_competition_id,
      COALESCE(product_record.name, comp_record.title),
      COALESCE(product_record.name_ar, comp_record.title_ar),
      COALESCE(product_record.image_url, comp_record.image_url),
      comp_record.ticket_price,
      COALESCE(comp_record.gift_tickets_per_purchase, 1),
      'purchase',
      comp_record.currency
    )
    RETURNING id INTO new_purchased_product_id;
  END LOOP;

  -- إضافة التذاكر الهدية للمستخدم
  INSERT INTO user_tickets (user_id, ticket_count)
  VALUES (current_user_id, total_gift_tickets)
  ON CONFLICT (user_id) DO UPDATE
  SET ticket_count = user_tickets.ticket_count + total_gift_tickets,
      updated_at = now();

  -- إرسال إشعار
  INSERT INTO notifications (user_id, title, message, type, related_id)
  VALUES (
    current_user_id,
    'تم شراء المنتج بنجاح! 🎁',
    'تم شراء ' || p_quantity || ' منتج وحصلت على ' || total_gift_tickets || ' تذكرة هدية مجانية!',
    'success',
    p_competition_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'quantity', p_quantity,
    'total_cost', total_cost,
    'gift_tickets', total_gift_tickets,
    'message', 'تم الشراء بنجاح!'
  );
END;
$$;

-- 7) دالة لإضافة جائزة كمنتج للمستخدم
CREATE OR REPLACE FUNCTION public.add_prize_as_product(
  p_user_id UUID,
  p_competition_id UUID,
  p_product_name TEXT,
  p_product_name_ar TEXT,
  p_product_image TEXT,
  p_product_value NUMERIC DEFAULT 0,
  p_product_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_id UUID;
BEGIN
  INSERT INTO user_purchased_products (
    user_id,
    product_id,
    competition_id,
    product_name,
    product_name_ar,
    product_image,
    product_price,
    gift_tickets,
    source_type
  )
  VALUES (
    p_user_id,
    p_product_id,
    p_competition_id,
    p_product_name,
    p_product_name_ar,
    p_product_image,
    p_product_value,
    0,
    'prize'
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

-- 8) دالة لطلب المنتجات المشتراة
CREATE OR REPLACE FUNCTION public.request_product_delivery(
  p_product_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id UUID;
  product_count INTEGER;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'غير مصرح');
  END IF;

  -- تحديث حالة المنتجات
  UPDATE user_purchased_products
  SET order_status = 'ordered',
      ordered_at = now(),
      updated_at = now()
  WHERE id = ANY(p_product_ids)
    AND user_id = current_user_id
    AND order_status = 'not_ordered';

  GET DIAGNOSTICS product_count = ROW_COUNT;

  IF product_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'لم يتم العثور على منتجات للطلب');
  END IF;

  -- إرسال إشعار
  INSERT INTO notifications (user_id, title, message, type)
  VALUES (
    current_user_id,
    'تم تسجيل طلب التوصيل',
    'تم تسجيل طلب توصيل ' || product_count || ' منتج. سيتم التواصل معك قريباً.',
    'info'
  );

  RETURN jsonb_build_object(
    'success', true,
    'products_ordered', product_count,
    'message', 'تم تسجيل الطلب بنجاح'
  );
END;
$$;

-- 9) تفعيل Realtime للجدول الجديد
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_purchased_products;