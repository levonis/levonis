
DROP FUNCTION IF EXISTS public.update_crossy_road_high_score(integer, integer);
DROP FUNCTION IF EXISTS public.admin_award_crossy_road_winners(timestamptz);

CREATE OR REPLACE FUNCTION public.update_crossy_road_high_score(p_score integer, p_steps integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN RETURN; END IF;
  INSERT INTO crossy_road_high_scores (user_id, high_score, best_steps, all_time_high_score)
  VALUES (v_user_id, p_score, p_steps, p_score)
  ON CONFLICT (user_id) DO UPDATE SET
    high_score = GREATEST(crossy_road_high_scores.high_score, p_score),
    best_steps = GREATEST(crossy_road_high_scores.best_steps, p_steps),
    all_time_high_score = GREATEST(crossy_road_high_scores.all_time_high_score, p_score),
    updated_at = now();
END;
$$;

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

  UPDATE crossy_road_high_scores SET high_score = 0, best_steps = 0, season = v_season + 1, updated_at = now() WHERE true;

  IF p_next_season_starts_at IS NOT NULL THEN
    UPDATE crossy_road_settings SET season_ends_at = p_next_season_starts_at, updated_at = now() WHERE true;
  ELSE
    UPDATE crossy_road_settings SET season_ends_at = NULL, updated_at = now() WHERE true;
  END IF;

  RETURN jsonb_build_object('success', true, 'winners_awarded', v_awarded);
END;
$$;
