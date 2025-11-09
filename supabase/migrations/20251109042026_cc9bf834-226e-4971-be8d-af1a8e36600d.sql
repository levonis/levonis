-- Fix search_path for calculate_user_level function
CREATE OR REPLACE FUNCTION public.calculate_user_level(points NUMERIC)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  level_result TEXT;
BEGIN
  SELECT level_key INTO level_result
  FROM loyalty_levels
  WHERE min_points <= points
  ORDER BY min_points DESC
  LIMIT 1;
  
  RETURN COALESCE(level_result, 'bronze');
END;
$$;