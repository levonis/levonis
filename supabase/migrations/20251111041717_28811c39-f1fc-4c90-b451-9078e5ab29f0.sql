-- Expand allowed order statuses to include new tracking stages
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (
    status IN (
      'pending',
      'confirmed',
      'processing',
      'arrived_warehouse',
      'shipped',
      'arrived_iraq',
      'delivered',
      'cancelled'
    )
  );

-- Fix ambiguous variable name in award_points_on_delivery function to prevent 42702 errors
CREATE OR REPLACE FUNCTION public.award_points_on_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  base_points NUMERIC;
  order_multiplier NUMERIC;
  points_to_add NUMERIC;
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
    points_to_add := base_points + (NEW.total_amount * order_multiplier);
    
    -- إضافة النقاط للمستخدم
    INSERT INTO user_points (user_id, total_points, available_points)
    VALUES (NEW.user_id, points_to_add, points_to_add)
    ON CONFLICT (user_id) DO UPDATE
    SET 
      total_points = user_points.total_points + points_to_add,
      available_points = user_points.available_points + points_to_add,
      updated_at = now();

    -- إضافة معاملة
    INSERT INTO points_transactions (user_id, points, type, source, related_id, description)
    VALUES (
      NEW.user_id,
      points_to_add,
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
$function$;