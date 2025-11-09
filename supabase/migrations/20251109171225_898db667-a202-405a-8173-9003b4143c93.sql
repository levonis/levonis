-- إضافة دالة للتحقق من أن المستخدم اشترى المنتج واستلمه
CREATE OR REPLACE FUNCTION public.has_purchased_product(p_user_id UUID, p_product_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM order_items oi
    INNER JOIN orders o ON oi.order_id = o.id
    WHERE o.user_id = p_user_id
      AND oi.product_id = p_product_id
      AND o.status = 'delivered'
    LIMIT 1
  );
END;
$$;

-- إضافة trigger للتحقق قبل إضافة تقييم
CREATE OR REPLACE FUNCTION public.verify_review_purchase()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- التحقق من أن المستخدم اشترى المنتج واستلمه
  IF NOT has_purchased_product(NEW.user_id, NEW.product_id) THEN
    RAISE EXCEPTION 'يمكنك التقييم فقط بعد شراء المنتج واستلامه';
  END IF;
  
  RETURN NEW;
END;
$$;

-- إنشاء trigger على جدول reviews
DROP TRIGGER IF EXISTS check_review_purchase ON public.reviews;
CREATE TRIGGER check_review_purchase
  BEFORE INSERT ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.verify_review_purchase();