CREATE OR REPLACE FUNCTION public.update_user_level()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_level TEXT;
  old_level TEXT;
  level_name_ar TEXT;
  msg TEXT;
BEGIN
  old_level := OLD.level;
  new_level := calculate_user_level(NEW.total_points);

  IF old_level IS DISTINCT FROM new_level THEN
    NEW.level := new_level;

    SELECT loyalty_levels.name_ar INTO level_name_ar
    FROM loyalty_levels
    WHERE level_key = new_level;

    msg := 'مبروك! لقد وصلت إلى مستوى ' || COALESCE(level_name_ar, new_level, 'جديد');

    BEGIN
      INSERT INTO notifications (user_id, title, message, type, related_id)
      VALUES (
        NEW.user_id,
        'ترقية المستوى!',
        msg,
        'success',
        NEW.user_id
      );
    EXCEPTION WHEN OTHERS THEN
      -- Never let a notification failure break the originating transaction (e.g. order creation)
      NULL;
    END;
  END IF;

  RETURN NEW;
END;
$function$;