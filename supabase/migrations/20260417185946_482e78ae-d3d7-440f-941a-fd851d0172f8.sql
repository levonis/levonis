
CREATE OR REPLACE FUNCTION public.auto_award_expired_seasons()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_prize record;
  v_hs record;
  v_awarded integer := 0;
  v_season integer;
  v_total integer := 0;
  v_settings record;
  v_results jsonb := '[]'::jsonb;
BEGIN
  -- CROSSY ROAD
  SELECT * INTO v_settings FROM crossy_road_settings LIMIT 1;
  IF v_settings.season_ends_at IS NOT NULL AND v_settings.season_ends_at <= now() THEN
    v_awarded := 0;
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
    UPDATE crossy_road_high_scores
      SET all_time_high_score = GREATEST(COALESCE(all_time_high_score, 0), COALESCE(high_score, 0)),
          high_score = 0, best_steps = 0, season = v_season + 1, updated_at = now()
      WHERE true;
    UPDATE crossy_road_settings SET season_ends_at = NULL, updated_at = now() WHERE true;
    v_total := v_total + v_awarded;
    v_results := v_results || jsonb_build_object('game', 'crossy_road', 'awarded', v_awarded);
  END IF;

  -- STACK TOWER
  SELECT * INTO v_settings FROM stack_game_settings LIMIT 1;
  IF v_settings.season_ends_at IS NOT NULL AND v_settings.season_ends_at <= now() THEN
    v_awarded := 0;
    SELECT COALESCE(MAX(season), 0) INTO v_season FROM stack_game_high_scores;
    FOR v_prize IN SELECT * FROM stack_game_leaderboard_prizes WHERE is_active ORDER BY position LOOP
      SELECT * INTO v_hs FROM stack_game_high_scores WHERE high_score > 0 ORDER BY high_score DESC OFFSET (v_prize.position - 1) LIMIT 1;
      IF v_hs IS NOT NULL THEN
        INSERT INTO stack_game_winners (user_id, prize_type, prize_name_ar, position, score, season, product_id, selected_color, selected_option_id)
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
    UPDATE stack_game_high_scores
      SET all_time_high_score = GREATEST(COALESCE(all_time_high_score, 0), COALESCE(high_score, 0)),
          high_score = 0, season = v_season + 1, updated_at = now()
      WHERE true;
    UPDATE stack_game_settings SET season_ends_at = NULL, updated_at = now() WHERE true;
    v_total := v_total + v_awarded;
    v_results := v_results || jsonb_build_object('game', 'stack', 'awarded', v_awarded);
  END IF;

  -- KNIFE RAIN
  SELECT * INTO v_settings FROM knife_rain_settings LIMIT 1;
  IF v_settings.season_ends_at IS NOT NULL AND v_settings.season_ends_at <= now() THEN
    v_awarded := 0;
    SELECT COALESCE(MAX(season), 0) INTO v_season FROM knife_rain_high_scores;
    FOR v_prize IN SELECT * FROM knife_rain_leaderboard_prizes WHERE is_active ORDER BY position LOOP
      SELECT * INTO v_hs FROM knife_rain_high_scores WHERE high_score > 0 ORDER BY high_score DESC OFFSET (v_prize.position - 1) LIMIT 1;
      IF v_hs IS NOT NULL THEN
        INSERT INTO knife_rain_winners (user_id, prize_type, prize_name_ar, position, score, season, product_id, selected_color, selected_option_id)
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
    UPDATE knife_rain_high_scores
      SET all_time_high_score = GREATEST(COALESCE(all_time_high_score, 0), COALESCE(high_score, 0)),
          high_score = 0, season = v_season + 1, updated_at = now()
      WHERE true;
    UPDATE knife_rain_settings SET season_ends_at = NULL, updated_at = now() WHERE true;
    v_total := v_total + v_awarded;
    v_results := v_results || jsonb_build_object('game', 'knife_rain', 'awarded', v_awarded);
  END IF;

  RETURN jsonb_build_object('success', true, 'total_awarded', v_total, 'results', v_results);
END;
$$;

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$ BEGIN
  PERFORM cron.unschedule('auto_award_expired_seasons_5min');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'auto_award_expired_seasons_5min',
  '*/5 * * * *',
  $cron$ SELECT public.auto_award_expired_seasons(); $cron$
);
