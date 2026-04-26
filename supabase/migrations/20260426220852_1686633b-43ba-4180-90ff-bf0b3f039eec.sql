-- 0) Drop restrictive CHECKs
ALTER TABLE public.loyalty_levels DROP CONSTRAINT IF EXISTS loyalty_levels_level_key_check;
ALTER TABLE public.user_points DROP CONSTRAINT IF EXISTS user_points_level_check;

-- 1) Add columns
ALTER TABLE public.loyalty_levels ADD COLUMN IF NOT EXISTS level_number INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS ux_loyalty_levels_level_number ON public.loyalty_levels(level_number);

ALTER TABLE public.user_points ADD COLUMN IF NOT EXISTS current_level_xp NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.user_points ADD COLUMN IF NOT EXISTS current_level_number INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.level_prizes ADD COLUMN IF NOT EXISTS level_number INTEGER;
ALTER TABLE public.level_prizes ADD COLUMN IF NOT EXISTS auto_grant BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.level_prizes ADD COLUMN IF NOT EXISTS coupon_code TEXT;
ALTER TABLE public.level_prizes ADD COLUMN IF NOT EXISTS tickets_count INTEGER;
ALTER TABLE public.level_prizes ADD COLUMN IF NOT EXISTS loyalty_card_level_id UUID;
ALTER TABLE public.level_prizes ADD COLUMN IF NOT EXISTS product_id UUID;
ALTER TABLE public.level_prizes ADD COLUMN IF NOT EXISTS is_random_product BOOLEAN NOT NULL DEFAULT false;

-- 2) Claims table
CREATE TABLE IF NOT EXISTS public.user_level_prize_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  level_number INTEGER NOT NULL,
  prize_id UUID NOT NULL REFERENCES public.level_prizes(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  granted_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, prize_id)
);
ALTER TABLE public.user_level_prize_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own level claims" ON public.user_level_prize_claims;
CREATE POLICY "Users view own level claims" ON public.user_level_prize_claims FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System inserts level claims" ON public.user_level_prize_claims;
CREATE POLICY "System inserts level claims" ON public.user_level_prize_claims FOR INSERT WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage all claims" ON public.user_level_prize_claims;
CREATE POLICY "Admins manage all claims" ON public.user_level_prize_claims FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- 3) Reuse existing rows + insert 5..100
DO $$
DECLARE
  r RECORD;
  i INTEGER := 1;
  threshold NUMERIC := 50000;
  thresholds NUMERIC[] := ARRAY[]::NUMERIC[];
  level_name TEXT;
  level_color TEXT;
  level_icon TEXT;
BEGIN
  FOR i IN 1..100 LOOP
    thresholds := array_append(thresholds, threshold);
    IF i < 10 THEN threshold := threshold * 2;
    ELSE threshold := ROUND(threshold * 1.20);
    END IF;
  END LOOP;

  i := 1;
  FOR r IN SELECT id FROM public.loyalty_levels ORDER BY display_order ASC LOOP
    IF i <= 10 THEN level_name := 'برونزي ' || i; level_color := '#CD7F32'; level_icon := 'medal';
    ELSIF i <= 25 THEN level_name := 'فضي ' || i; level_color := '#C0C0C0'; level_icon := 'award';
    ELSIF i <= 50 THEN level_name := 'ذهبي ' || i; level_color := '#FFD700'; level_icon := 'star';
    ELSIF i <= 75 THEN level_name := 'بلاتيني ' || i; level_color := '#E5E4E2'; level_icon := 'gem';
    ELSE level_name := 'أسطوري ' || i; level_color := '#9333EA'; level_icon := 'crown';
    END IF;
    UPDATE public.loyalty_levels
    SET level_key='level_'||i, level_number=i, name_ar=level_name, name_en='Level '||i,
        min_points=thresholds[i], xp_required=thresholds[i],
        color=level_color, icon=level_icon, display_order=i, is_purchasable=false, benefits='[]'::jsonb
    WHERE id = r.id;
    i := i + 1;
  END LOOP;

  WHILE i <= 100 LOOP
    IF i <= 10 THEN level_name := 'برونزي ' || i; level_color := '#CD7F32'; level_icon := 'medal';
    ELSIF i <= 25 THEN level_name := 'فضي ' || i; level_color := '#C0C0C0'; level_icon := 'award';
    ELSIF i <= 50 THEN level_name := 'ذهبي ' || i; level_color := '#FFD700'; level_icon := 'star';
    ELSIF i <= 75 THEN level_name := 'بلاتيني ' || i; level_color := '#E5E4E2'; level_icon := 'gem';
    ELSE level_name := 'أسطوري ' || i; level_color := '#9333EA'; level_icon := 'crown';
    END IF;
    INSERT INTO public.loyalty_levels (level_key, level_number, name_ar, name_en, min_points, xp_required, color, icon, display_order, is_purchasable, benefits)
    VALUES ('level_'||i, i, level_name, 'Level '||i, thresholds[i], thresholds[i], level_color, level_icon, i, false, '[]'::jsonb);
    i := i + 1;
  END LOOP;
END $$;

-- 4) Drop old level trigger
DROP TRIGGER IF EXISTS update_user_level_trigger ON public.user_points;

-- 5) RPC add_user_level_xp
CREATE OR REPLACE FUNCTION public.add_user_level_xp(p_user_id UUID, p_amount NUMERIC)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_current_xp NUMERIC := 0;
  v_current_level INTEGER := 1;
  v_threshold NUMERIC;
  v_levels_gained INTEGER := 0;
  v_prize RECORD;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid_amount'); END IF;

  INSERT INTO public.user_points (user_id, total_points, available_points)
  VALUES (p_user_id, 0, 0) ON CONFLICT (user_id) DO NOTHING;

  SELECT current_level_xp, GREATEST(current_level_number, 1) INTO v_current_xp, v_current_level
  FROM public.user_points WHERE user_id = p_user_id FOR UPDATE;

  v_current_xp := COALESCE(v_current_xp, 0) + p_amount;

  LOOP
    SELECT xp_required INTO v_threshold FROM public.loyalty_levels WHERE level_number = v_current_level;
    EXIT WHEN v_threshold IS NULL OR v_current_xp < v_threshold OR v_current_level >= 100;
    v_current_xp := v_current_xp - v_threshold;
    v_current_level := v_current_level + 1;
    v_levels_gained := v_levels_gained + 1;

    IF v_current_level % 5 = 0 THEN
      FOR v_prize IN SELECT id, prize_type, auto_grant FROM public.level_prizes WHERE level_number = v_current_level AND is_active = true LOOP
        INSERT INTO public.user_level_prize_claims (user_id, level_number, prize_id, status, granted_at)
        VALUES (p_user_id, v_current_level, v_prize.id,
          CASE WHEN v_prize.auto_grant THEN 'granted' ELSE 'pending' END,
          CASE WHEN v_prize.auto_grant THEN now() ELSE NULL END)
        ON CONFLICT (user_id, prize_id) DO NOTHING;
      END LOOP;
      INSERT INTO public.notifications (user_id, title, message, type, related_id)
      VALUES (p_user_id, 'مبروك! ترقية مستوى', 'وصلت إلى المستوى ' || v_current_level || ' — تحقق من جوائزك!', 'success', p_user_id);
    END IF;
  END LOOP;

  UPDATE public.user_points
  SET current_level_xp = v_current_xp, current_level_number = v_current_level,
      total_xp = COALESCE(total_xp, 0) + p_amount, level = 'level_' || v_current_level, updated_at = now()
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object('ok', true, 'level', v_current_level, 'current_xp', v_current_xp, 'levels_gained', v_levels_gained);
END; $$;

-- 6) recalculate
CREATE OR REPLACE FUNCTION public.recalculate_user_level(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(total_amount), 0) INTO v_total FROM public.orders WHERE user_id = p_user_id AND status IN ('delivered','completed');
  UPDATE public.user_points SET current_level_xp=0, current_level_number=1, total_xp=0 WHERE user_id = p_user_id;
  IF v_total > 0 THEN PERFORM add_user_level_xp(p_user_id, v_total); END IF;
  RETURN jsonb_build_object('ok', true, 'recomputed_xp', v_total);
END; $$;

-- 7) order trigger
CREATE OR REPLACE FUNCTION public.process_order_level_xp()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('delivered','completed') AND (OLD.status IS NULL OR OLD.status NOT IN ('delivered','completed'))
     AND NEW.user_id IS NOT NULL AND NEW.total_amount > 0 THEN
    PERFORM add_user_level_xp(NEW.user_id, NEW.total_amount);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_order_level_xp ON public.orders;
CREATE TRIGGER trg_order_level_xp AFTER UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.process_order_level_xp();

-- 8) Recalculate ALL existing users
DO $$ DECLARE u RECORD;
BEGIN
  FOR u IN SELECT DISTINCT user_id FROM public.orders WHERE status IN ('delivered','completed') LOOP
    PERFORM recalculate_user_level(u.user_id);
  END LOOP;
END $$;

-- 9) updated_at trigger
DROP TRIGGER IF EXISTS trg_user_level_prize_claims_updated_at ON public.user_level_prize_claims;
CREATE TRIGGER trg_user_level_prize_claims_updated_at
BEFORE UPDATE ON public.user_level_prize_claims
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();