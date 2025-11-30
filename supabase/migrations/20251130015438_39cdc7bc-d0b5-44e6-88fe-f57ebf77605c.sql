-- جعل product_id nullable في order_items للسماح بالطلبات المخصصة
ALTER TABLE public.order_items 
ALTER COLUMN product_id DROP NOT NULL;

-- إضافة عمود custom_request_id للطلبات المخصصة
ALTER TABLE public.order_items 
ADD COLUMN IF NOT EXISTS custom_request_id UUID REFERENCES public.custom_product_requests(id);

-- إضافة constraint للتأكد من وجود إما product_id أو custom_request_id
ALTER TABLE public.order_items
ADD CONSTRAINT order_items_product_or_custom_check 
CHECK (product_id IS NOT NULL OR custom_request_id IS NOT NULL);