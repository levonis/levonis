-- تحديث دالة منح النقاط لدعم النقاط المتغيرة حسب قيمة الطلب
CREATE OR REPLACE FUNCTION public.award_points_on_delivery()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  base_points NUMERIC;
  order_multiplier NUMERIC;
  total_points NUMERIC;
  settings_data JSONB;
BEGIN
  IF OLD.status != 'delivered' AND NEW.status = 'delivered' THEN
    -- جلب الإعدادات
    SELECT setting_value INTO settings_data
    FROM default_settings
    WHERE setting_key = 'points_settings';

    -- النقاط الأساسية
    base_points := COALESCE((settings_data->>'points_per_order')::NUMERIC, 10);
    
    -- معامل النقاط حسب قيمة الطلب
    order_multiplier := COALESCE((settings_data->>'order_value_multiplier')::NUMERIC, 0);
    
    -- حساب النقاط الإجمالية
    total_points := base_points + (NEW.total_amount * order_multiplier);
    
    -- إضافة النقاط للمستخدم
    INSERT INTO user_points (user_id, total_points, available_points)
    VALUES (NEW.user_id, total_points, total_points)
    ON CONFLICT (user_id) DO UPDATE
    SET 
      total_points = user_points.total_points + total_points,
      available_points = user_points.available_points + total_points,
      updated_at = now();

    -- إضافة معاملة
    INSERT INTO points_transactions (user_id, points, type, source, related_id, description)
    VALUES (
      NEW.user_id,
      total_points,
      'earned',
      'order',
      NEW.id,
      CASE 
        WHEN order_multiplier > 0 THEN
          'نقاط الشراء - طلب رقم: ' || NEW.order_number || ' (' || base_points || ' نقطة أساسية + ' || (NEW.total_amount * order_multiplier) || ' نقطة حسب قيمة الطلب)'
        ELSE
          'نقاط الشراء - طلب رقم: ' || NEW.order_number
      END
    );
  END IF;

  RETURN NEW;
END;
$$;

-- إضافة دالة لمنح نقاط التقييم المؤكد
CREATE OR REPLACE FUNCTION public.award_points_on_verified_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  points_to_award NUMERIC;
  order_status TEXT;
BEGIN
  -- التحقق من أن الطلب تم توصيله (مؤكد)
  SELECT status INTO order_status
  FROM orders
  WHERE id = (
    SELECT order_id 
    FROM order_items 
    WHERE product_id = NEW.product_id 
    AND order_id IN (
      SELECT id FROM orders WHERE user_id = NEW.user_id AND status = 'delivered'
    )
    LIMIT 1
  );

  -- إذا كان الطلب مؤكد، نمنح نقاط إضافية
  IF order_status = 'delivered' THEN
    SELECT COALESCE((setting_value->>'points_per_verified_review')::NUMERIC, 10)
    INTO points_to_award
    FROM default_settings
    WHERE setting_key = 'points_settings';

    INSERT INTO user_points (user_id, total_points, available_points)
    VALUES (NEW.user_id, points_to_award, points_to_award)
    ON CONFLICT (user_id) DO UPDATE
    SET 
      total_points = user_points.total_points + points_to_award,
      available_points = user_points.available_points + points_to_award,
      updated_at = now();

    INSERT INTO points_transactions (user_id, points, type, source, related_id, description)
    VALUES (
      NEW.user_id,
      points_to_award,
      'earned',
      'verified_review',
      NEW.id,
      'نقاط تقييم طلب مؤكد'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- إنشاء trigger لتقييم الطلبات المؤكدة
DROP TRIGGER IF EXISTS award_verified_review_points ON reviews;
CREATE TRIGGER award_verified_review_points
AFTER INSERT ON reviews
FOR EACH ROW
EXECUTE FUNCTION award_points_on_verified_review();