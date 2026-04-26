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
  bonus_pct NUMERIC := 0;
  bonus_points NUMERIC := 0;
  level_name TEXT;
  settings_data JSONB;
  points_enabled TEXT;
BEGIN
  IF OLD.status != 'delivered' AND NEW.status = 'delivered' THEN
    SELECT setting_value INTO settings_data
    FROM default_settings
    WHERE setting_key = 'points_settings';

    points_enabled := COALESCE(settings_data->>'points_status', 'disabled');

    IF points_enabled != 'enabled' THEN
      RETURN NEW;
    END IF;

    base_points := COALESCE((settings_data->>'points_per_order')::NUMERIC, 10);
    order_multiplier := COALESCE((settings_data->>'order_value_multiplier')::NUMERIC, 0);

    points_to_add := base_points + (NEW.total_amount * order_multiplier);

    -- Apply loyalty bonus points percentage from the user's active card
    SELECT COALESCE(ll.bonus_points_percentage, 0), ll.name_ar
      INTO bonus_pct, level_name
    FROM public.user_cards uc
    JOIN public.loyalty_levels ll ON ll.id = uc.level_id
    WHERE uc.user_id = NEW.user_id
      AND uc.is_active = true
      AND (uc.expires_at IS NULL OR uc.expires_at > now())
    ORDER BY ll.min_points DESC NULLS LAST
    LIMIT 1;

    IF bonus_pct > 0 THEN
      bonus_points := FLOOR(points_to_add * bonus_pct / 100);
      points_to_add := points_to_add + bonus_points;
    END IF;

    INSERT INTO user_points (user_id, total_points, available_points)
    VALUES (NEW.user_id, points_to_add, points_to_add)
    ON CONFLICT (user_id) DO UPDATE
    SET
      total_points = user_points.total_points + points_to_add,
      available_points = user_points.available_points + points_to_add,
      updated_at = now();

    INSERT INTO points_transactions (user_id, points, type, source, related_id, description)
    VALUES (
      NEW.user_id,
      points_to_add,
      'earned',
      'order',
      NEW.id,
      CASE
        WHEN bonus_points > 0 AND order_multiplier > 0 THEN
          'نقاط الشراء - طلب رقم: ' || NEW.order_number || ' (' || base_points || ' أساسية + ' || (NEW.total_amount * order_multiplier) || ' حسب القيمة + ' || bonus_points || ' بونص ' || COALESCE(level_name, '') || ' ' || bonus_pct || '%)'
        WHEN bonus_points > 0 THEN
          'نقاط الشراء - طلب رقم: ' || NEW.order_number || ' (' || base_points || ' أساسية + ' || bonus_points || ' بونص ' || COALESCE(level_name, '') || ' ' || bonus_pct || '%)'
        WHEN order_multiplier > 0 THEN
          'نقاط الشراء - طلب رقم: ' || NEW.order_number || ' (' || base_points || ' نقطة أساسية + ' || (NEW.total_amount * order_multiplier) || ' حسب قيمة الطلب)'
        ELSE
          'نقاط الشراء - طلب رقم: ' || NEW.order_number
      END
    );
  END IF;
  RETURN NEW;
END;
$function$;