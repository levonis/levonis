
-- Add product_id to stack game milestones
ALTER TABLE public.stack_game_milestones
  ADD COLUMN product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;

-- Add product_id to stack game leaderboard prizes
ALTER TABLE public.stack_game_leaderboard_prizes
  ADD COLUMN product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;

-- Universal function to deduct stock when a prize is won
-- Works for any prize system (games, competitions, etc.)
CREATE OR REPLACE FUNCTION public.deduct_prize_stock(p_product_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product products%ROWTYPE;
BEGIN
  IF p_product_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO v_product FROM products WHERE id = p_product_id FOR UPDATE;
  
  IF v_product.id IS NULL THEN
    RETURN false;
  END IF;

  -- Deduct from direct_stock if available
  IF v_product.direct_stock IS NOT NULL AND v_product.direct_stock > 0 THEN
    UPDATE products 
    SET direct_stock = direct_stock - 1,
        updated_at = now()
    WHERE id = p_product_id AND direct_stock > 0;
    RETURN true;
  END IF;

  -- Deduct from pre_order_stock as fallback
  IF v_product.pre_order_stock IS NOT NULL AND v_product.pre_order_stock > 0 THEN
    UPDATE products 
    SET pre_order_stock = pre_order_stock - 1,
        updated_at = now()
    WHERE id = p_product_id AND pre_order_stock > 0;
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- Update check_stack_milestone to also deduct product stock
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
  -- Find active milestone where score >= target and stock available
  SELECT * INTO v_milestone
  FROM stack_game_milestones
  WHERE is_active = true AND p_score >= target_score AND claimed_count < stock
  ORDER BY target_score DESC
  LIMIT 1;

  IF v_milestone.id IS NULL THEN
    RETURN v_result;
  END IF;

  -- Check if user already claimed this milestone
  SELECT EXISTS(SELECT 1 FROM stack_game_milestone_claims WHERE milestone_id = v_milestone.id AND user_id = p_user_id)
  INTO v_already_claimed;

  IF v_already_claimed THEN
    RETURN v_result;
  END IF;

  -- If milestone has a product, deduct stock
  IF v_milestone.product_id IS NOT NULL THEN
    IF NOT deduct_prize_stock(v_milestone.product_id) THEN
      -- Product out of stock, skip
      RETURN '{"won": false, "reason": "product_out_of_stock"}'::jsonb;
    END IF;
    
    SELECT name_ar, image_url INTO v_product_name, v_product_image
    FROM products WHERE id = v_milestone.product_id;
  END IF;

  -- Claim it
  INSERT INTO stack_game_milestone_claims (milestone_id, user_id, session_id, score_achieved)
  VALUES (v_milestone.id, p_user_id, p_session_id, p_score);

  UPDATE stack_game_milestones SET claimed_count = claimed_count + 1, updated_at = now()
  WHERE id = v_milestone.id;

  -- Record in winners
  INSERT INTO stack_game_winners (user_id, prize_name_ar, prize_type, score, product_id)
  VALUES (p_user_id, COALESCE(v_product_name, v_milestone.prize_name_ar), 'milestone', p_score, v_milestone.product_id);

  v_result := jsonb_build_object(
    'won', true,
    'prize_name', COALESCE(v_product_name, v_milestone.prize_name_ar),
    'prize_image', COALESCE(v_product_image, v_milestone.prize_image_url),
    'stock_remaining', v_milestone.stock - v_milestone.claimed_count - 1
  );

  RETURN v_result;
END;
$$;

-- Add product_id to winners table
ALTER TABLE public.stack_game_winners
  ADD COLUMN product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;

-- Update admin_award_stack_winners to deduct product stock
CREATE OR REPLACE FUNCTION public.admin_award_stack_winners()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prize stack_game_leaderboard_prizes%ROWTYPE;
  v_player stack_game_high_scores%ROWTYPE;
  v_winners_count integer := 0;
  v_current_season integer;
  v_product_name text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN '{"error": "unauthorized"}'::jsonb;
  END IF;

  SELECT COALESCE(
    (SELECT (setting_value->>'stack_season')::integer FROM default_settings WHERE setting_key = 'game_seasons'),
    1
  ) INTO v_current_season;

  FOR v_prize IN SELECT * FROM stack_game_leaderboard_prizes WHERE is_active = true ORDER BY position ASC
  LOOP
    SELECT * INTO v_player
    FROM stack_game_high_scores
    WHERE high_score > 0
    ORDER BY high_score DESC, achieved_at ASC
    OFFSET (v_prize.position - 1) LIMIT 1;

    IF v_player.user_id IS NOT NULL THEN
      -- Deduct stock if product linked
      IF v_prize.product_id IS NOT NULL THEN
        PERFORM deduct_prize_stock(v_prize.product_id);
        SELECT name_ar INTO v_product_name FROM products WHERE id = v_prize.product_id;
      ELSE
        v_product_name := NULL;
      END IF;

      INSERT INTO stack_game_winners (user_id, prize_name_ar, prize_type, position, score, season, product_id)
      VALUES (v_player.user_id, COALESCE(v_product_name, v_prize.prize_name_ar), 'leaderboard', v_prize.position, v_player.high_score, v_current_season, v_prize.product_id);
      v_winners_count := v_winners_count + 1;
    END IF;
  END LOOP;

  UPDATE stack_game_high_scores SET high_score = 0, achieved_at = now();

  INSERT INTO default_settings (setting_key, setting_value)
  VALUES ('game_seasons', jsonb_build_object('stack_season', v_current_season + 1))
  ON CONFLICT (setting_key) DO UPDATE
  SET setting_value = jsonb_build_object('stack_season', v_current_season + 1),
      updated_at = now();

  RETURN jsonb_build_object('winners_awarded', v_winners_count, 'new_season', v_current_season + 1);
END;
$$;
