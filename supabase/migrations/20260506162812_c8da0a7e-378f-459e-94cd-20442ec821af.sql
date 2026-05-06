-- Helper: returns current sub-cycle window for a user card.
-- A card spans expires_at - purchased_at (e.g. 180d). Each sub-cycle lasts membership_cards.duration_days (e.g. 30d).
-- Cycle limits (free shipping uses, percentage discount cap, per-category discount uses) reset at each cycle boundary.
CREATE OR REPLACE FUNCTION public.get_user_card_cycle(p_card_id uuid)
RETURNS TABLE (
  cycle_start timestamptz,
  cycle_end timestamptz,
  cycle_index integer,
  total_cycles integer,
  duration_days integer
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_purchased timestamptz;
  v_expires   timestamptz;
  v_duration  integer;
  v_total     integer;
  v_idx       integer;
  v_now       timestamptz := now();
BEGIN
  SELECT uc.purchased_at, uc.expires_at, COALESCE(mc.duration_days, 30)
    INTO v_purchased, v_expires, v_duration
  FROM public.user_cards uc
  JOIN public.membership_cards mc ON mc.id = uc.card_id
  WHERE uc.id = p_card_id;

  IF v_purchased IS NULL THEN
    RETURN;
  END IF;

  IF v_duration IS NULL OR v_duration < 1 THEN
    v_duration := 30;
  END IF;

  IF v_expires IS NOT NULL THEN
    v_total := GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_expires - v_purchased)) / (v_duration * 86400.0))::int);
  ELSE
    v_total := 1;
  END IF;

  v_idx := GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (v_now - v_purchased)) / (v_duration * 86400.0))::int);
  IF v_idx >= v_total THEN
    v_idx := v_total - 1;
  END IF;

  cycle_start  := v_purchased + (v_idx * v_duration) * INTERVAL '1 day';
  cycle_end    := v_purchased + ((v_idx + 1) * v_duration) * INTERVAL '1 day';
  cycle_index  := v_idx;
  total_cycles := v_total;
  duration_days := v_duration;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_card_cycle(uuid) TO authenticated;

-- Update percentage discount counter to count only current cycle usage.
CREATE OR REPLACE FUNCTION public.get_card_percentage_discount_used(p_card_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(SUM(u.discount_amount), 0)::NUMERIC
  FROM public.loyalty_percentage_discount_usage u
  CROSS JOIN LATERAL public.get_user_card_cycle(p_card_id) cy
  WHERE u.card_id = p_card_id
    AND u.used_at >= cy.cycle_start
    AND u.used_at <  cy.cycle_end;
$$;

-- Update free shipping counter to count only current cycle usage.
CREATE OR REPLACE FUNCTION public.get_card_free_shipping_used(p_card_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(COUNT(*)::INTEGER, 0)
  FROM public.loyalty_free_shipping_usage u
  CROSS JOIN LATERAL public.get_user_card_cycle(p_card_id) cy
  WHERE u.card_id = p_card_id
    AND u.used_at >= cy.cycle_start
    AND u.used_at <  cy.cycle_end;
$$;