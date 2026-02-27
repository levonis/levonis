
-- تحديث دالة منح النقاط عند تسليم الطلب لتشمل مكافأة بطاقة العضوية (bonus_points_percentage)
CREATE OR REPLACE FUNCTION public.handle_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  settings_data JSONB;
  points_enabled TEXT;
  base_points NUMERIC;
  order_multiplier NUMERIC;
  points_to_add NUMERIC;
  bonus_percentage NUMERIC := 0;
  bonus_points NUMERIC := 0;
  user_card_record RECORD;
BEGIN
  -- Only process when status changes to 'delivered'
  IF NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered') THEN
    -- تحديث وقت التسليم
    NEW.delivered_at := COALESCE(NEW.delivered_at, now());

    -- جلب إعدادات النقاط
    SELECT setting_value INTO settings_data
    FROM default_settings
    WHERE setting_key = 'points_settings';

    IF settings_data IS NULL THEN
      RETURN NEW;
    END IF;

    -- التحقق من حالة نظام النقاط
    points_enabled := COALESCE(settings_data->>'points_status', 'disabled');
    
    IF points_enabled != 'enabled' THEN
      RETURN NEW;
    END IF;

    -- النقاط الأساسية
    base_points := COALESCE((settings_data->>'points_per_order')::NUMERIC, 10);
    
    -- معامل النقاط حسب قيمة الطلب
    order_multiplier := COALESCE((settings_data->>'order_value_multiplier')::NUMERIC, 0);
    
    -- حساب النقاط الأساسية
    points_to_add := base_points + (NEW.total_amount * order_multiplier);
    
    -- التحقق من بطاقة العضوية النشطة للمستخدم وإضافة نسبة النقاط الإضافية
    SELECT ll.bonus_points_percentage INTO bonus_percentage
    FROM user_cards uc
    JOIN loyalty_levels ll ON ll.id = uc.level_id
    WHERE uc.user_id = NEW.user_id
      AND uc.is_active = true
      AND uc.expires_at > now()
    LIMIT 1;
    
    IF bonus_percentage IS NOT NULL AND bonus_percentage > 0 THEN
      bonus_points := ROUND(points_to_add * bonus_percentage / 100);
      points_to_add := points_to_add + bonus_points;
    END IF;
    
    -- إضافة النقاط للمستخدم
    INSERT INTO user_points (user_id, total_points, available_points)
    VALUES (NEW.user_id, points_to_add, points_to_add)
    ON CONFLICT (user_id) DO UPDATE
    SET 
      total_points = user_points.total_points + points_to_add,
      available_points = user_points.available_points + points_to_add,
      updated_at = now();

    -- إضافة معاملة مع تفاصيل المكافأة
    INSERT INTO points_transactions (user_id, points, type, source, related_id, description)
    VALUES (
      NEW.user_id,
      points_to_add,
      'earned',
      'order',
      NEW.id,
      CASE 
        WHEN bonus_points > 0 THEN
          'نقاط الشراء - طلب رقم: ' || NEW.order_number || ' (' || (points_to_add - bonus_points) || ' + ' || bonus_points || ' نقاط إضافية من بطاقة العضوية ' || bonus_percentage || '%)'
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
