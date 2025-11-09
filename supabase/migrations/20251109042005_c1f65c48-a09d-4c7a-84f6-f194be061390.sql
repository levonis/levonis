-- Fix search_path for award_points_on_delivery function
CREATE OR REPLACE FUNCTION public.award_points_on_delivery()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  points_to_award NUMERIC;
BEGIN
  IF OLD.status != 'delivered' AND NEW.status = 'delivered' THEN
    SELECT COALESCE((setting_value->>'value')::NUMERIC, 10)
    INTO points_to_award
    FROM default_settings
    WHERE setting_key = 'points_per_order';

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
      'order',
      NEW.id,
      'نقاط الشراء - طلب رقم: ' || NEW.order_number
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Fix search_path for award_points_on_review function
CREATE OR REPLACE FUNCTION public.award_points_on_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  points_to_award NUMERIC;
BEGIN
  SELECT COALESCE((setting_value->>'value')::NUMERIC, 5)
  INTO points_to_award
  FROM default_settings
  WHERE setting_key = 'points_per_review';

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