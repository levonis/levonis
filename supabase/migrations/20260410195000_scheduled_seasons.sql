-- 1. Add scheduling column to crossy_road_settings (in case it wasn't added)
ALTER TABLE public.crossy_road_settings 
ADD COLUMN IF NOT EXISTS next_season_starts_at timestamptz DEFAULT NULL;

-- 2. Update the RPC function to handle scheduling and fix failures
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
  v_option_name text;
BEGIN
  -- Get current season
  SELECT COALESCE(MAX(season), 0) INTO v_season FROM crossy_road_high_scores;

  -- Verify there are players with scores > 0
  IF NOT EXISTS (SELECT 1 FROM crossy_road_high_scores WHERE high_score > 0) THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'لا يوجد لاعبين لديهم نتائج لتتويجهم'
    );
  END IF;

  -- 1. Award Leaderboard Prizes
  FOR v_prize IN 
    SELECT * FROM crossy_road_leaderboard_prizes 
    WHERE is_active = true 
    ORDER BY position ASC 
  LOOP
    -- Get the player at this position
    SELECT * INTO v_hs 
    FROM crossy_road_high_scores 
    WHERE high_score > 0 
    ORDER BY high_score DESC 
    OFFSET (v_prize.position - 1) 
    LIMIT 1;

    IF v_hs IS NOT NULL THEN
      -- Record winner
      INSERT INTO crossy_road_winners (
        user_id, 
        prize_type, 
        prize_name_ar, 
        position, 
        score, 
        season, 
        product_id, 
        selected_color, 
        selected_option_id
      )
      VALUES (
        v_hs.user_id, 
        'leaderboard', 
        v_prize.prize_name_ar, 
        v_prize.position, 
        v_hs.high_score, 
        v_season, 
        v_prize.product_id, 
        v_prize.selected_color, 
        v_prize.selected_option_id
      );

      -- Add product to cart if available
      IF v_prize.product_id IS NOT NULL THEN
        -- Insert into cart_items
        INSERT INTO cart_items (
          user_id, 
          product_id, 
          quantity, 
          is_gift, 
          is_locked, 
          selected_color, 
          product_option_id,
          sale_type,
          shipping_option_index
        )
        VALUES (
          v_hs.user_id, 
          v_prize.product_id, 
          1, 
          true, 
          true, 
          v_prize.selected_color, 
          v_prize.selected_option_id,
          'direct',
          -1
        )
        ON CONFLICT DO NOTHING;

        -- Attempt to deduct stock
        BEGIN
          -- Fetch option name if ID exists
          v_option_name := NULL;
          IF v_prize.selected_option_id IS NOT NULL THEN
            SELECT name_ar INTO v_option_name FROM product_options WHERE id = v_prize.selected_option_id;
          END IF;

          -- Call with correct signature: (uuid, color_text, option_name_text)
          PERFORM deduct_prize_stock(v_prize.product_id, v_prize.selected_color, v_option_name);
        EXCEPTION WHEN OTHERS THEN
          NULL;
        END;
      END IF;

      v_awarded := v_awarded + 1;
    END IF;
  END LOOP;

  -- 2. Reset scores and increment season
  UPDATE crossy_road_high_scores 
  SET high_score = 0, 
      best_steps = 0, 
      season = v_season + 1, 
      updated_at = now();

  -- 3. Update game settings with next season start time
  UPDATE crossy_road_settings 
  SET next_season_starts_at = p_next_season_starts_at,
      updated_at = now();

  RETURN jsonb_build_object(
    'success', true, 
    'winners_awarded', v_awarded,
    'next_season', v_season + 1,
    'starts_at', p_next_season_starts_at
  );
END;
$$;

-- 3. GRANT EXECUTE PERMISSIONS (Crucial for frontend access)
GRANT EXECUTE ON FUNCTION public.admin_award_crossy_road_winners(timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_award_crossy_road_winners(timestamptz) TO service_role;
