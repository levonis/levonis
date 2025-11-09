-- Fix search_path for update_user_level function
CREATE OR REPLACE FUNCTION public.update_user_level()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_level TEXT;
  old_level TEXT;
  level_name_ar TEXT;
BEGIN
  old_level := OLD.level;
  new_level := calculate_user_level(NEW.total_points);
  
  IF old_level IS DISTINCT FROM new_level THEN
    NEW.level := new_level;
    
    SELECT loyalty_levels.name_ar INTO level_name_ar
    FROM loyalty_levels
    WHERE level_key = new_level;
    
    INSERT INTO notifications (user_id, title, message, type, related_id)
    VALUES (
      NEW.user_id,
      'ترقية المستوى!',
      'مبروك! لقد وصلت إلى مستوى ' || level_name_ar,
      'success',
      NEW.user_id
    );
  END IF;
  
  RETURN NEW;
END;
$$;