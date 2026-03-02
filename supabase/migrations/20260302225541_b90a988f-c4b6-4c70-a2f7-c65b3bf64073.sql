
CREATE OR REPLACE FUNCTION public.game_award_points(
  p_user_id UUID,
  p_amount INT,
  p_game_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transaction_id UUID;
BEGIN
  -- Only the player themselves can claim their own points
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Cap game rewards to prevent abuse (max 100 points per call)
  IF p_amount <= 0 OR p_amount > 100 THEN
    RAISE EXCEPTION 'Invalid points amount';
  END IF;

  -- Create transaction
  INSERT INTO points_transactions (user_id, points, type, source, description)
  VALUES (p_user_id, p_amount, 'earn', 'game', p_game_name || ': +' || p_amount || ' نقطة')
  RETURNING id INTO v_transaction_id;
  
  -- Upsert and recalculate points
  INSERT INTO user_points (user_id, total_points, available_points)
  VALUES (p_user_id, GREATEST(0, p_amount), GREATEST(0, p_amount))
  ON CONFLICT (user_id)
  DO UPDATE SET 
    total_points = user_points.total_points + p_amount,
    available_points = (
      SELECT COALESCE(SUM(points), 0)
      FROM points_transactions
      WHERE user_id = p_user_id
    ),
    updated_at = NOW();
  
  RETURN v_transaction_id;
END;
$$;
