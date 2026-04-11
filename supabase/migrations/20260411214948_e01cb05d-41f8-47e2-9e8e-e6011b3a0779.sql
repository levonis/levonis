
-- Drop both overloads and recreate with the correct one
DROP FUNCTION IF EXISTS public.admin_award_crossy_road_winners();
DROP FUNCTION IF EXISTS public.admin_award_crossy_road_winners(timestamptz);

CREATE OR REPLACE FUNCTION public.admin_award_crossy_road_winners(p_next_season_starts_at timestamptz DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prize record;
  v_hs record;
  v_awarded integer := 0;
  v_season integer;
BEGIN
  -- Admin check
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT COALESCE(MAX(season), 0) INTO v_season FROM crossy_road_high_scores;

  FOR v_prize IN SELECT * FROM crossy_road_leaderboard_prizes WHERE is_active ORDER BY position LOOP
    SELECT * INTO v_hs FROM crossy_road_high_scores WHERE high_score > 0 ORDER BY high_score DESC OFFSET (v_prize.position - 1) LIMIT 1;
    IF v_hs IS NOT NULL THEN
      INSERT INTO crossy_road_winners (user_id, prize_type, prize_name_ar, position, score, season, product_id, selected_color, selected_option_id)
      VALUES (v_hs.user_id, 'leaderboard', v_prize.prize_name_ar, v_prize.position, v_hs.high_score, v_season, v_prize.product_id, v_prize.selected_color, v_prize.selected_option_id);

      IF v_prize.product_id IS NOT NULL THEN
        INSERT INTO cart_items (user_id, product_id, quantity, is_gift, is_locked, selected_color, product_option_id)
        VALUES (v_hs.user_id, v_prize.product_id, 1, true, true, v_prize.selected_color, v_prize.selected_option_id)
        ON CONFLICT DO NOTHING;
        BEGIN PERFORM deduct_prize_stock(v_prize.product_id, v_prize.selected_color, v_prize.selected_option_id); EXCEPTION WHEN OTHERS THEN NULL; END;
      END IF;

      v_awarded := v_awarded + 1;
    END IF;
  END LOOP;

  -- Reset scores for new season (WHERE true to satisfy safety rule)
  UPDATE crossy_road_high_scores SET high_score = 0, best_steps = 0, season = v_season + 1, updated_at = now() WHERE true;

  RETURN jsonb_build_object('success', true, 'winners_awarded', v_awarded);
END;
$$;

-- Also fix stack_game award function with same WHERE true pattern
DROP FUNCTION IF EXISTS public.admin_award_stack_winners();

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

  UPDATE stack_game_high_scores SET high_score = 0, achieved_at = now() WHERE true;

  INSERT INTO default_settings (setting_key, setting_value)
  VALUES ('game_seasons', jsonb_build_object('stack_season', v_current_season + 1))
  ON CONFLICT (setting_key) DO UPDATE
  SET setting_value = jsonb_build_object('stack_season', v_current_season + 1),
      updated_at = now();

  RETURN jsonb_build_object('winners_awarded', v_winners_count, 'new_season', v_current_season + 1);
END;
$$;
