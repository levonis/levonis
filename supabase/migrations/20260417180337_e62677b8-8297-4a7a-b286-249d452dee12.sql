
-- 1) BACKFILL all_time_high_score from sessions

-- Stack Game: update existing rows
UPDATE public.stack_game_high_scores hs
SET all_time_high_score = GREATEST(COALESCE(hs.all_time_high_score, 0), COALESCE(hs.high_score, 0), s.max_score)
FROM (SELECT user_id, MAX(score) AS max_score FROM public.stack_game_sessions WHERE score > 0 GROUP BY user_id) s
WHERE hs.user_id = s.user_id
  AND s.max_score > COALESCE(hs.all_time_high_score, 0);

-- Stack Game: insert missing
INSERT INTO public.stack_game_high_scores (user_id, high_score, all_time_high_score)
SELECT s.user_id, 0, s.max_score
FROM (SELECT user_id, MAX(score) AS max_score FROM public.stack_game_sessions WHERE score > 0 GROUP BY user_id) s
LEFT JOIN public.stack_game_high_scores hs ON hs.user_id = s.user_id
WHERE hs.user_id IS NULL;

-- Knife Rain: update existing
UPDATE public.knife_rain_high_scores hs
SET all_time_high_score = GREATEST(COALESCE(hs.all_time_high_score, 0), COALESCE(hs.high_score, 0), s.max_score)
FROM (SELECT user_id, MAX(score) AS max_score FROM public.knife_rain_sessions WHERE score > 0 GROUP BY user_id) s
WHERE hs.user_id = s.user_id
  AND s.max_score > COALESCE(hs.all_time_high_score, 0);

-- Knife Rain: insert missing
INSERT INTO public.knife_rain_high_scores (user_id, high_score, all_time_high_score)
SELECT s.user_id, 0, s.max_score
FROM (SELECT user_id, MAX(score) AS max_score FROM public.knife_rain_sessions WHERE score > 0 GROUP BY user_id) s
LEFT JOIN public.knife_rain_high_scores hs ON hs.user_id = s.user_id
WHERE hs.user_id IS NULL;

-- Crossy Road: update existing
UPDATE public.crossy_road_high_scores hs
SET all_time_high_score = GREATEST(COALESCE(hs.all_time_high_score, 0), COALESCE(hs.high_score, 0), s.max_score)
FROM (SELECT user_id, MAX(score) AS max_score FROM public.crossy_road_sessions WHERE score > 0 GROUP BY user_id) s
WHERE hs.user_id = s.user_id
  AND s.max_score > COALESCE(hs.all_time_high_score, 0);

-- Crossy Road: insert missing
INSERT INTO public.crossy_road_high_scores (user_id, high_score, all_time_high_score)
SELECT s.user_id, 0, s.max_score
FROM (SELECT user_id, MAX(score) AS max_score FROM public.crossy_road_sessions WHERE score > 0 GROUP BY user_id) s
LEFT JOIN public.crossy_road_high_scores hs ON hs.user_id = s.user_id
WHERE hs.user_id IS NULL;

-- 2) HARDEN reset functions

-- Knife Rain: stop deleting; preserve all_time
CREATE OR REPLACE FUNCTION public.admin_award_knife_rain_winners()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_prize knife_rain_leaderboard_prizes%ROWTYPE;
  v_hs record;
  v_awarded integer := 0;
  v_product_name text;
  v_option_name text;
BEGIN
  IF NOT public.has_role(v_user_id, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_admin');
  END IF;

  FOR v_prize IN SELECT * FROM knife_rain_leaderboard_prizes WHERE is_active = true ORDER BY position ASC
  LOOP
    SELECT * INTO v_hs FROM knife_rain_high_scores WHERE high_score > 0 ORDER BY high_score DESC LIMIT 1 OFFSET (v_prize.position - 1);
    IF v_hs IS NULL THEN CONTINUE; END IF;

    IF v_prize.product_id IS NOT NULL THEN
      v_option_name := NULL;
      IF v_prize.selected_option_id IS NOT NULL THEN
        SELECT name_ar INTO v_option_name FROM product_options WHERE id = v_prize.selected_option_id;
      END IF;
      PERFORM public.deduct_prize_stock(v_prize.product_id, v_prize.selected_color, v_option_name);
      SELECT name_ar INTO v_product_name FROM products WHERE id = v_prize.product_id;

      INSERT INTO cart_items (user_id, product_id, product_option_id, selected_color, quantity, is_gift, is_locked)
      VALUES (v_hs.user_id, v_prize.product_id, v_prize.selected_option_id, v_prize.selected_color, 1, true, true);
    END IF;

    INSERT INTO knife_rain_winners (user_id, prize_type, prize_name_ar, score, position)
    VALUES (v_hs.user_id, 'leaderboard', COALESCE(v_product_name, v_prize.prize_name_ar), v_hs.high_score, v_prize.position);

    v_awarded := v_awarded + 1;
  END LOOP;

  -- Preserve all-time peak, then zero season score (instead of DELETE)
  UPDATE knife_rain_high_scores
  SET all_time_high_score = GREATEST(COALESCE(all_time_high_score, 0), COALESCE(high_score, 0)),
      high_score = 0
  WHERE true;

  RETURN jsonb_build_object('success', true, 'winners_awarded', v_awarded);
END;
$function$;

-- Stack Game: explicit GREATEST in reset
CREATE OR REPLACE FUNCTION public.admin_award_stack_winners()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Preserve all-time peak before zeroing season score
  UPDATE stack_game_high_scores
  SET all_time_high_score = GREATEST(COALESCE(all_time_high_score, 0), COALESCE(high_score, 0)),
      high_score = 0,
      achieved_at = now()
  WHERE true;

  INSERT INTO default_settings (setting_key, setting_value)
  VALUES ('game_seasons', jsonb_build_object('stack_season', v_current_season + 1))
  ON CONFLICT (setting_key) DO UPDATE
  SET setting_value = jsonb_build_object('stack_season', v_current_season + 1),
      updated_at = now();

  RETURN jsonb_build_object('winners_awarded', v_winners_count, 'new_season', v_current_season + 1);
END;
$function$;

-- Crossy Road: explicit GREATEST in reset
CREATE OR REPLACE FUNCTION public.admin_award_crossy_road_winners(p_next_season_starts_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Preserve all-time peak before zeroing season score
  UPDATE crossy_road_high_scores
  SET all_time_high_score = GREATEST(COALESCE(all_time_high_score, 0), COALESCE(high_score, 0)),
      high_score = 0,
      best_steps = 0,
      season = v_season + 1,
      updated_at = now()
  WHERE true;

  IF p_next_season_starts_at IS NOT NULL THEN
    UPDATE crossy_road_settings SET season_ends_at = p_next_season_starts_at, updated_at = now() WHERE true;
  ELSE
    UPDATE crossy_road_settings SET season_ends_at = NULL, updated_at = now() WHERE true;
  END IF;

  RETURN jsonb_build_object('success', true, 'winners_awarded', v_awarded);
END;
$function$;
