
CREATE OR REPLACE FUNCTION public.check_stack_milestone(p_user_id uuid, p_score integer, p_session_id text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_milestone stack_game_milestones%ROWTYPE;
  v_result jsonb := '{"won": false, "won_prizes": []}'::jsonb;
  v_product_name text;
  v_product_image text;
  v_already_claimed boolean;
  v_won_prizes jsonb := '[]'::jsonb;
  v_prize_entry jsonb;
  v_primary_prize jsonb := NULL;
  v_prizes_count integer := 0;
  v_option_name text;
BEGIN
  FOR v_milestone IN
    SELECT *
    FROM public.stack_game_milestones
    WHERE is_active = true
      AND p_score >= target_score
      AND claimed_count < stock
    ORDER BY target_score DESC
  LOOP
    SELECT EXISTS(
      SELECT 1
      FROM public.stack_game_milestone_claims
      WHERE milestone_id = v_milestone.id
        AND user_id = p_user_id
    )
    INTO v_already_claimed;

    IF v_already_claimed THEN
      CONTINUE;
    END IF;

    v_product_name := NULL;
    v_product_image := NULL;
    v_option_name := NULL;

    IF v_milestone.product_id IS NOT NULL THEN
      -- Get option name if selected_option_id is set
      IF v_milestone.selected_option_id IS NOT NULL THEN
        SELECT name_ar INTO v_option_name FROM public.product_options WHERE id = v_milestone.selected_option_id;
      END IF;

      IF NOT public.deduct_prize_stock(v_milestone.product_id, v_milestone.selected_color, v_option_name) THEN
        CONTINUE;
      END IF;

      SELECT name_ar, image_url
      INTO v_product_name, v_product_image
      FROM public.products
      WHERE id = v_milestone.product_id;
    END IF;

    BEGIN
      INSERT INTO public.stack_game_milestone_claims (milestone_id, user_id, session_id, score_achieved)
      VALUES (v_milestone.id, p_user_id, p_session_id, p_score);
    EXCEPTION
      WHEN unique_violation THEN
        CONTINUE;
    END;

    UPDATE public.stack_game_milestones
    SET claimed_count = claimed_count + 1,
        updated_at = now()
    WHERE id = v_milestone.id;

    INSERT INTO public.stack_game_winners (user_id, prize_name_ar, prize_type, score, product_id, selected_color, selected_option_id)
    VALUES (
      p_user_id,
      COALESCE(v_product_name, v_milestone.prize_name_ar),
      'milestone',
      p_score,
      v_milestone.product_id,
      v_milestone.selected_color,
      v_milestone.selected_option_id
    );

    INSERT INTO public.game_prizes (user_id, game_name, prize_name_ar, prize_type, prize_image_url, product_id, score_achieved, how_won_ar)
    VALUES (
      p_user_id,
      'البرج',
      COALESCE(v_product_name, v_milestone.prize_name_ar),
      'milestone',
      COALESCE(v_product_image, v_milestone.prize_image_url),
      v_milestone.product_id,
      p_score,
      'هدف مرحلي - سكور ' || p_score
    );

    IF v_milestone.product_id IS NOT NULL THEN
      INSERT INTO public.cart_items (
        user_id, product_id, product_option_id, selected_color,
        quantity, sale_type, is_gift, is_locked
      )
      SELECT
        p_user_id, v_milestone.product_id, v_milestone.selected_option_id,
        v_milestone.selected_color, 1, 'direct', true, true
      WHERE NOT EXISTS (
        SELECT 1 FROM public.cart_items
        WHERE user_id = p_user_id
          AND product_id = v_milestone.product_id
          AND is_gift = true
          AND product_option_id IS NOT DISTINCT FROM v_milestone.selected_option_id
          AND selected_color IS NOT DISTINCT FROM v_milestone.selected_color
      );
    END IF;

    v_prize_entry := jsonb_strip_nulls(jsonb_build_object(
      'milestone_id', v_milestone.id,
      'target_score', v_milestone.target_score,
      'prize_name', COALESCE(v_product_name, v_milestone.prize_name_ar),
      'prize_image', COALESCE(v_product_image, v_milestone.prize_image_url),
      'stock_remaining', v_milestone.stock - v_milestone.claimed_count - 1
    ));

    v_won_prizes := v_won_prizes || jsonb_build_array(v_prize_entry);
    v_prizes_count := v_prizes_count + 1;

    IF v_primary_prize IS NULL THEN
      v_primary_prize := v_prize_entry;
    END IF;
  END LOOP;

  IF v_prizes_count = 0 THEN
    RETURN v_result;
  END IF;

  RETURN jsonb_strip_nulls(jsonb_build_object(
    'won', true,
    'milestone_id', v_primary_prize ->> 'milestone_id',
    'prize_name', CASE
      WHEN v_prizes_count = 1 THEN v_primary_prize ->> 'prize_name'
      ELSE (v_primary_prize ->> 'prize_name') || ' + ' || (v_prizes_count - 1)::text || ' جائزة أخرى'
    END,
    'prize_image', v_primary_prize ->> 'prize_image',
    'stock_remaining', CASE WHEN v_prizes_count = 1 THEN (v_primary_prize ->> 'stock_remaining')::integer ELSE NULL END,
    'prizes_count', v_prizes_count,
    'won_prizes', v_won_prizes
  ));
END;
$$;
