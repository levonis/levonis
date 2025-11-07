-- إضافة حقول الطلب المسبق مع خيارات الشحن
ALTER TABLE public.products
ADD COLUMN availability_type text DEFAULT 'in_stock' NOT NULL CHECK (availability_type IN ('in_stock', 'pre_order')),
ADD COLUMN pre_order_free_shipping_price numeric(10,2),
ADD COLUMN pre_order_fast_shipping_price numeric(10,2);

COMMENT ON COLUMN public.products.availability_type IS 'نوع التوفر: متاح في المخزن أو طلب مسبق';
COMMENT ON COLUMN public.products.pre_order_free_shipping_price IS 'سعر الطلب المسبق مع شحن مجاني 45 يوماً';
COMMENT ON COLUMN public.products.pre_order_fast_shipping_price IS 'سعر الطلب المسبق مع شحن سريع 15 يوماً';