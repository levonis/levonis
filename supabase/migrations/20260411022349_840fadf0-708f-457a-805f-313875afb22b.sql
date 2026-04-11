
-- 1. Recreate admin_award_crossy_road_winners with optional parameter
CREATE OR REPLACE FUNCTION public.admin_award_crossy_road_winners(
  p_next_season_starts_at timestamptz DEFAULT NULL
)
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

  -- Reset scores for new season
  UPDATE crossy_road_high_scores SET high_score = 0, best_steps = 0, season = v_season + 1, updated_at = now();

  RETURN jsonb_build_object('success', true, 'winners_awarded', v_awarded);
END;
$$;

-- 2. Admin RLS policies for order_items
DO $$
BEGIN
  -- Delete policy
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'order_items' AND policyname = 'Admins can delete order items') THEN
    CREATE POLICY "Admins can delete order items"
      ON public.order_items FOR DELETE TO authenticated
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;

  -- Update policy
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'order_items' AND policyname = 'Admins can update order items') THEN
    CREATE POLICY "Admins can update order items"
      ON public.order_items FOR UPDATE TO authenticated
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;

  -- Insert policy
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'order_items' AND policyname = 'Admins can insert order items') THEN
    CREATE POLICY "Admins can insert order items"
      ON public.order_items FOR INSERT TO authenticated
      WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END$$;
