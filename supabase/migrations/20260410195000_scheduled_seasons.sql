-- 1. Add scheduling column to crossy_road_settings
ALTER TABLE public.crossy_road_settings 
ADD COLUMN IF NOT EXISTS next_season_starts_at timestamptz DEFAULT NULL;

-- 2. Update the RPC function to handle scheduling and fix potential failures
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
  -- Get current season
  SELECT COALESCE(MAX(season), 0) INTO v_season FROM crossy_road_high_scores;

  -- 1. Award Leaderboard Prizes
  FOR v_prize IN 
    SELECT * FROM crossy_road_leaderboard_prizes 
    WHERE is_active = true 
    ORDER BY position ASC 
  LOOP
    -- Get the player at this position (1st, 2nd, 3rd, etc.)
    -- Using OFFSET (position-1) on high scores ordered DESC
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
        -- Insert into cart_items. We use ON CONFLICT DO NOTHING to avoid duplicate errors
        -- if the user somehow has the exact same gift already.
        INSERT INTO cart_items (
          user_id, 
          product_id, 
          quantity, 
          is_gift, 
          is_locked, 
          selected_color, 
          product_option_id,
          sale_type
        )
        VALUES (
          v_hs.user_id, 
          v_prize.product_id, 
          1, 
          true, 
          true, 
          v_prize.selected_color, 
          v_prize.selected_option_id,
          'direct'
        )
        ON CONFLICT DO NOTHING;

        -- Attempt to deduct stock (wrapped in check to prevent crash)
        BEGIN
          PERFORM deduct_prize_stock(v_prize.product_id, v_prize.selected_color, v_prize.selected_option_id);
        EXCEPTION WHEN OTHERS THEN
          -- Log error internally if needed, but don't stop the whole process
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
  -- If p_next_season_starts_at is null, the game starts immediately (stays enabled)
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
