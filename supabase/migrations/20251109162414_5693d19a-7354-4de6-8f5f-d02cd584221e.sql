-- Update generate_referral_code to use username
CREATE OR REPLACE FUNCTION public.generate_referral_code(user_username TEXT)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN 'REF-' || upper(user_username);
END;
$$;

-- Update award_points_on_review to read from settings
CREATE OR REPLACE FUNCTION public.award_points_on_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  points_to_award NUMERIC;
  settings_data JSONB;
BEGIN
  -- جلب الإعدادات
  SELECT setting_value INTO settings_data
  FROM default_settings
  WHERE setting_key = 'points_settings';

  points_to_award := COALESCE((settings_data->>'points_per_review')::NUMERIC, 5);

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
    'review',
    NEW.id,
    'نقاط التقييم'
  );

  RETURN NEW;
END;
$$;

-- Update award_points_on_verified_review to read from settings
CREATE OR REPLACE FUNCTION public.award_points_on_verified_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  points_to_award NUMERIC;
  order_status TEXT;
  settings_data JSONB;
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
    -- جلب الإعدادات
    SELECT setting_value INTO settings_data
    FROM default_settings
    WHERE setting_key = 'points_settings';

    points_to_award := COALESCE((settings_data->>'points_per_verified_review')::NUMERIC, 10);

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

-- Add referral settings to default_settings if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM default_settings WHERE setting_key = 'referral_settings'
  ) THEN
    INSERT INTO default_settings (setting_key, setting_value)
    VALUES ('referral_settings', '{"points_for_referrer": 50, "points_for_referred": 20}'::jsonb);
  END IF;
END $$;

-- Create function to award referral points
CREATE OR REPLACE FUNCTION public.award_referral_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  referrer_points NUMERIC;
  referred_points NUMERIC;
  settings_data JSONB;
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- جلب إعدادات الدعوة
    SELECT setting_value INTO settings_data
    FROM default_settings
    WHERE setting_key = 'referral_settings';

    referrer_points := COALESCE((settings_data->>'points_for_referrer')::NUMERIC, 50);
    referred_points := COALESCE((settings_data->>'points_for_referred')::NUMERIC, 20);

    -- منح نقاط للمُحيل
    INSERT INTO user_points (user_id, total_points, available_points)
    VALUES (NEW.referrer_user_id, referrer_points, referrer_points)
    ON CONFLICT (user_id) DO UPDATE
    SET 
      total_points = user_points.total_points + referrer_points,
      available_points = user_points.available_points + referrer_points,
      updated_at = now();

    INSERT INTO points_transactions (user_id, points, type, source, related_id, description)
    VALUES (
      NEW.referrer_user_id,
      referrer_points,
      'earned',
      'referral',
      NEW.id,
      'نقاط دعوة صديق'
    );

    -- منح نقاط للمُحال
    IF NEW.referred_user_id IS NOT NULL THEN
      INSERT INTO user_points (user_id, total_points, available_points)
      VALUES (NEW.referred_user_id, referred_points, referred_points)
      ON CONFLICT (user_id) DO UPDATE
      SET 
        total_points = user_points.total_points + referred_points,
        available_points = user_points.available_points + referred_points,
        updated_at = now();

      INSERT INTO points_transactions (user_id, points, type, source, related_id, description)
      VALUES (
        NEW.referred_user_id,
        referred_points,
        'earned',
        'referred',
        NEW.id,
        'نقاط الانضمام عبر دعوة'
      );
    END IF;

    -- تحديث points_awarded
    NEW.points_awarded := referrer_points;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for referral points
DROP TRIGGER IF EXISTS trigger_award_referral_points ON user_referrals;
CREATE TRIGGER trigger_award_referral_points
  BEFORE UPDATE ON user_referrals
  FOR EACH ROW
  EXECUTE FUNCTION award_referral_points();