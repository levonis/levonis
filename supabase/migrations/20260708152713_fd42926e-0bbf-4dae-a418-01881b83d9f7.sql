
-- Expand allowed sources
ALTER TABLE public.points_transactions DROP CONSTRAINT IF EXISTS points_transactions_source_check;
ALTER TABLE public.points_transactions ADD CONSTRAINT points_transactions_source_check
  CHECK (source = ANY (ARRAY[
    'order','order_delivered','review','coupon','cash','daily_task','referral','referred',
    'verified_review','wallet_conversion','admin_adjustment','tickets_conversion','avatar_frame',
    'spend','frame_purchase','rating','merchant_rating','game_store','offer_purchase',
    'cart_redemption','order_backfill','review_bonus','review_bonus_revoked'
  ]));

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS points_awarded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS admin_quality_multiplier INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS base_points_snapshot INT;

CREATE OR REPLACE FUNCTION public._review_base_points(p_user_id UUID, p_product_id UUID)
RETURNS INT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT FLOOR(oi.total_price / 1000)::INT
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  WHERE o.user_id = p_user_id
    AND oi.product_id = p_product_id
    AND (o.user_confirmed_delivery = true OR o.auto_confirmed = true)
  ORDER BY o.created_at DESC
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.award_review_bonus_points()
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r RECORD; v_base INT; v_multiplier INT;
  v_has_image BOOLEAN; v_has_video BOOLEAN;
  v_award INT; v_count INT := 0;
BEGIN
  FOR r IN
    SELECT id, user_id, product_id, media_files, video_url, admin_quality_multiplier
    FROM public.reviews
    WHERE COALESCE(points_awarded, 0) = 0
      AND status = 'approved'
      AND created_at < now() - interval '48 hours'
  LOOP
    v_has_image := (r.media_files IS NOT NULL AND array_length(r.media_files, 1) > 0);
    v_has_video := (r.video_url IS NOT NULL AND length(r.video_url) > 0);
    IF NOT v_has_image THEN CONTINUE; END IF;

    v_base := public._review_base_points(r.user_id, r.product_id);
    IF v_base IS NULL OR v_base <= 0 THEN CONTINUE; END IF;

    v_multiplier := CASE WHEN v_has_video THEN 2 ELSE 1 END + COALESCE(r.admin_quality_multiplier, 0);
    IF v_multiplier > 3 THEN v_multiplier := 3; END IF;
    v_award := v_base * v_multiplier;
    IF v_award IS NULL OR v_award <= 0 THEN CONTINUE; END IF;

    INSERT INTO public.user_points (user_id, total_points, available_points, total_earned)
    VALUES (r.user_id, v_award, v_award, v_award)
    ON CONFLICT (user_id) DO UPDATE
      SET total_points = COALESCE(public.user_points.total_points, 0) + EXCLUDED.total_points,
          available_points = COALESCE(public.user_points.available_points, 0) + EXCLUDED.available_points,
          total_earned = COALESCE(public.user_points.total_earned, 0) + EXCLUDED.total_earned,
          updated_at = now();

    INSERT INTO public.points_transactions (user_id, points, type, source, related_id, description)
    VALUES (r.user_id, v_award, 'earned', 'review_bonus', r.id, format('بونص تقييم x%s', v_multiplier));

    UPDATE public.reviews
    SET points_awarded = v_award, points_awarded_at = now(), base_points_snapshot = v_base
    WHERE id = r.id;

    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public._on_review_delete_reclaim_points()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF COALESCE(OLD.points_awarded, 0) > 0 THEN
    UPDATE public.user_points
    SET total_points = GREATEST(0, COALESCE(total_points,0) - OLD.points_awarded),
        available_points = GREATEST(0, COALESCE(available_points,0) - OLD.points_awarded),
        updated_at = now()
    WHERE user_id = OLD.user_id;
    INSERT INTO public.points_transactions (user_id, points, type, source, related_id, description)
    VALUES (OLD.user_id, -OLD.points_awarded, 'revoked', 'review_bonus_revoked', OLD.id, 'سحب بونص تقييم محذوف');
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_review_delete_reclaim ON public.reviews;
CREATE TRIGGER trg_review_delete_reclaim
BEFORE DELETE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public._on_review_delete_reclaim_points();

DO $$
DECLARE j_id BIGINT;
BEGIN
  SELECT jobid INTO j_id FROM cron.job WHERE jobname = 'award-review-bonus-points-hourly';
  IF j_id IS NOT NULL THEN PERFORM cron.unschedule(j_id); END IF;
  PERFORM cron.schedule('award-review-bonus-points-hourly', '5 * * * *',
    $cron$SELECT public.award_review_bonus_points();$cron$);
END $$;

SELECT public.award_review_bonus_points() AS awarded_count;
