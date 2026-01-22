-- Create merchant_products table
CREATE TABLE IF NOT EXISTS public.merchant_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.merchant_applications(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  price_iqd INTEGER, -- سعر (اختياري)
  original_price_iqd INTEGER, -- سعر قبل الخصم (اختياري)
  image_urls TEXT[], -- صور متعددة
  video_url TEXT, -- رابط الفيديو (اختياري)
  primary_image_index INTEGER DEFAULT 0, -- الصورة الرئيسية (0 = أول صورة)
  is_active BOOLEAN NOT NULL DEFAULT true, -- تفعيل/إخفاء
  estimated_days INTEGER, -- وقت التنفيذ التقديري (اختياري)
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on merchant_products
ALTER TABLE public.merchant_products ENABLE ROW LEVEL SECURITY;

-- Policy: التجار يقدرون يشوفون منتجاتهم الخاصة
CREATE POLICY "Merchants can view their own products"
ON public.merchant_products
FOR SELECT
USING (
  auth.uid() IN (
    SELECT user_id FROM public.merchant_applications WHERE id = merchant_products.merchant_id
  )
);

-- Policy: التجار يقدرون يضيفون منتجات جديدة
CREATE POLICY "Merchants can insert their own products"
ON public.merchant_products
FOR INSERT
WITH CHECK (
  auth.uid() IN (
    SELECT user_id FROM public.merchant_applications WHERE id = merchant_products.merchant_id
  )
);

-- Policy: التجار يقدرون يعدلون منتجاتهم الخاصة
CREATE POLICY "Merchants can update their own products"
ON public.merchant_products
FOR UPDATE
USING (
  auth.uid() IN (
    SELECT user_id FROM public.merchant_applications WHERE id = merchant_products.merchant_id
  )
);

-- Policy: التجار يقدرون يحذفون منتجاتهم الخاصة
CREATE POLICY "Merchants can delete their own products"
ON public.merchant_products
FOR DELETE
USING (
  auth.uid() IN (
    SELECT user_id FROM public.merchant_applications WHERE id = merchant_products.merchant_id
  )
);

-- Policy: الجميع (بمن فيهم الزوار غير المسجلين) يقدرون يشوفون المنتجات النشطة
CREATE POLICY "Anyone can view active products"
ON public.merchant_products
FOR SELECT
USING (is_active = true);

-- Create index for faster merchant product queries
CREATE INDEX IF NOT EXISTS idx_merchant_products_merchant_id ON public.merchant_products(merchant_id);
CREATE INDEX IF NOT EXISTS idx_merchant_products_is_active ON public.merchant_products(is_active);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_merchant_products_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_merchant_products_updated_at
BEFORE UPDATE ON public.merchant_products
FOR EACH ROW
EXECUTE FUNCTION public.update_merchant_products_updated_at_column();