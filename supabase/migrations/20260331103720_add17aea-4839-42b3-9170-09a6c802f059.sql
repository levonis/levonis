
CREATE OR REPLACE FUNCTION public.check_stack_milestone(p_user_id uuid, p_score integer, p_session_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_milestone stack_game_milestones%ROWTYPE;
  v_already_claimed boolean;
  v_result jsonb := '{"won": false}'::jsonb;
  v_product_name text;
  v_product_image text;
BEGIN
  SELECT * INTO v_milestone
  FROM stack_game_milestones
  WHERE is_active = true AND p_score >= target_score AND claimed_count < stock
  ORDER BY target_score DESC
  LIMIT 1;

  IF v_milestone.id IS NULL THEN
    RETURN v_result;
  END IF;

  SELECT EXISTS(SELECT 1 FROM stack_game_milestone_claims WHERE milestone_id = v_milestone.id AND user_id = p_user_id)
  INTO v_already_claimed;

  IF v_already_claimed THEN
    RETURN v_result;
  END IF;

  IF v_milestone.product_id IS NOT NULL THEN
    IF NOT deduct_prize_stock(v_milestone.product_id) THEN
      RETURN '{"won": false, "reason": "product_out_of_stock"}'::jsonb;
    END IF;

    SELECT name_ar, image_url INTO v_product_name, v_product_image
    FROM products WHERE id = v_milestone.product_id;
  END IF;

  INSERT INTO stack_game_milestone_claims (milestone_id, user_id, session_id, score_achieved)
  VALUES (v_milestone.id, p_user_id, p_session_id, p_score);

  UPDATE stack_game_milestones SET claimed_count = claimed_count + 1, updated_at = now()
  WHERE id = v_milestone.id;

  INSERT INTO stack_game_winners (user_id, prize_name_ar, prize_type, score, product_id)
  VALUES (p_user_id, COALESCE(v_product_name, v_milestone.prize_name_ar), 'milestone', p_score, v_milestone.product_id);

  v_result := jsonb_build_object(
    'won', true,
    'milestone_id', v_milestone.id,
    'prize_name', COALESCE(v_product_name, v_milestone.prize_name_ar),
    'prize_image', COALESCE(v_product_image, v_milestone.prize_image_url),
    'stock_remaining', v_milestone.stock - v_milestone.claimed_count - 1
  );

  RETURN v_result;
END;
$$;
