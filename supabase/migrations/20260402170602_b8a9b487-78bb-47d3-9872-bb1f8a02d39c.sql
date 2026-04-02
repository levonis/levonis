
DROP FUNCTION IF EXISTS public.check_stack_milestone(uuid, integer, uuid);

CREATE OR REPLACE FUNCTION public.check_stack_milestone(p_user_id uuid, p_score integer, p_session_id uuid)
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

  -- Also insert into unified game_prizes
  INSERT INTO game_prizes (user_id, game_name, prize_name_ar, prize_type, prize_image_url, product_id, score_achieved, how_won_ar)
  VALUES (p_user_id, 'البرج', COALESCE(v_product_name, v_milestone.prize_name_ar), 'milestone', COALESCE(v_product_image, v_milestone.prize_image_url), v_milestone.product_id, p_score, 'هدف مرحلي - سكور ' || p_score);

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

-- Update end_stack_game to return session_id
CREATE OR REPLACE FUNCTION public.end_stack_game(p_session_token text, p_score integer, p_perfect_count integer, p_max_combo integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_session stack_game_sessions%ROWTYPE;
  v_settings stack_game_settings%ROWTYPE;
  v_game_score integer;
  v_website_points integer;
  v_elapsed_seconds numeric;
  v_max_reasonable_score integer;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO v_session
  FROM stack_game_sessions
  WHERE session_token = p_session_token AND user_id = v_user_id AND status = 'active'
  FOR UPDATE;

  IF v_session.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_session');
  END IF;

  v_elapsed_seconds := EXTRACT(EPOCH FROM (now() - v_session.started_at));
  v_max_reasonable_score := GREATEST(FLOOR(v_elapsed_seconds / 0.5)::integer, 5);
  
  IF p_score > v_max_reasonable_score THEN
    p_score := v_max_reasonable_score;
    p_perfect_count := LEAST(p_perfect_count, p_score / 3);
  END IF;

  SELECT * INTO v_settings FROM stack_game_settings LIMIT 1;

  v_game_score := p_score * v_settings.game_points_per_block
                + p_perfect_count * v_settings.game_perfect_bonus
                + FLOOR(p_max_combo * v_settings.game_combo_multiplier)::integer;

  v_website_points := FLOOR(
    p_score * v_settings.points_per_block
    + p_perfect_count * v_settings.perfect_bonus_points
    + p_max_combo * v_settings.combo_bonus_multiplier
  )::integer;

  UPDATE stack_game_sessions
  SET score = v_game_score,
      perfect_count = p_perfect_count,
      max_combo = p_max_combo,
      points_awarded = v_website_points,
      status = 'completed',
      ended_at = now()
  WHERE id = v_session.id;

  IF v_website_points > 0 THEN
    INSERT INTO user_points (user_id, available_points, total_earned)
    VALUES (v_user_id, v_website_points, v_website_points)
    ON CONFLICT (user_id) DO UPDATE
    SET available_points = user_points.available_points + v_website_points,
        total_earned = user_points.total_earned + v_website_points,
        updated_at = now();
  END IF;

  UPDATE stack_game_settings
  SET total_plays = total_plays + 1,
      total_points_distributed = total_points_distributed + v_website_points,
      updated_at = now()
  WHERE id = v_settings.id;

  RETURN jsonb_build_object(
    'success', true,
    'game_score', v_game_score,
    'points_awarded', v_website_points,
    'final_score', v_game_score,
    'session_id', v_session.id
  );
END;
$$;
