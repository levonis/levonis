CREATE OR REPLACE FUNCTION public.admin_get_user_card_cycles_summary(
  p_search text DEFAULT NULL,
  p_min_duration_days integer DEFAULT NULL,
  p_only_active boolean DEFAULT true
)
RETURNS TABLE (
  user_card_id uuid,
  user_id uuid,
  username text,
  full_name text,
  card_id uuid,
  card_name_ar text,
  card_name_en text,
  card_key text,
  purchased_at timestamptz,
  expires_at timestamptz,
  is_active boolean,
  duration_days integer,
  total_cycles integer,
  current_cycle_index integer,
  cycle_start timestamptz,
  cycle_end timestamptz,
  days_left_in_cycle integer,
  days_left_in_card integer,
  validity_status text,
  redeemed_code text,
  percentage_max_amount numeric,
  percentage_used_in_cycle numeric,
  percentage_remaining_in_cycle numeric,
  free_shipping_max_uses integer,
  free_shipping_used_in_cycle integer,
  free_shipping_remaining_in_cycle integer
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    uc.id AS user_card_id,
    uc.user_id,
    p.username,
    p.full_name,
    mc.id AS card_id,
    mc.name_ar AS card_name_ar,
    mc.name_en AS card_name_en,
    mc.card_key,
    uc.purchased_at,
    uc.expires_at,
    uc.is_active,
    cy.duration_days,
    cy.total_cycles,
    cy.cycle_index AS current_cycle_index,
    cy.cycle_start,
    cy.cycle_end,
    GREATEST(0, CEIL(EXTRACT(EPOCH FROM (cy.cycle_end - now())) / 86400.0))::int AS days_left_in_cycle,
    CASE WHEN uc.expires_at IS NULL THEN NULL
         ELSE GREATEST(0, CEIL(EXTRACT(EPOCH FROM (uc.expires_at - now())) / 86400.0))::int
    END AS days_left_in_card,
    CASE
      WHEN NOT uc.is_active THEN 'inactive'
      WHEN uc.expires_at IS NOT NULL AND uc.expires_at < now() THEN 'expired'
      WHEN uc.expires_at IS NOT NULL AND uc.expires_at < now() + interval '7 days' THEN 'expiring_soon'
      ELSE 'active'
    END AS validity_status,
    (SELECT lcc.code FROM public.loyalty_card_codes lcc
       WHERE lcc.redeemed_by_user_id = uc.user_id
         AND lcc.card_id = uc.card_id
         AND lcc.status = 'redeemed'
       ORDER BY lcc.redeemed_at DESC LIMIT 1) AS redeemed_code,
    mc.discount_percentage_max_amount AS percentage_max_amount,
    COALESCE((
      SELECT SUM(u.discount_amount)::numeric
      FROM public.loyalty_percentage_discount_usage u
      WHERE u.card_id = uc.id
        AND u.used_at >= cy.cycle_start
        AND u.used_at <  cy.cycle_end
    ), 0) AS percentage_used_in_cycle,
    CASE WHEN mc.discount_percentage_max_amount IS NULL THEN NULL
      ELSE GREATEST(0, mc.discount_percentage_max_amount - COALESCE((
        SELECT SUM(u.discount_amount)::numeric
        FROM public.loyalty_percentage_discount_usage u
        WHERE u.card_id = uc.id
          AND u.used_at >= cy.cycle_start
          AND u.used_at <  cy.cycle_end
      ), 0))
    END AS percentage_remaining_in_cycle,
    mc.free_shipping_max_uses AS free_shipping_max_uses,
    COALESCE((
      SELECT COUNT(*)::int
      FROM public.loyalty_free_shipping_usage f
      WHERE f.card_id = uc.id
        AND f.used_at >= cy.cycle_start
        AND f.used_at <  cy.cycle_end
    ), 0) AS free_shipping_used_in_cycle,
    CASE WHEN mc.free_shipping_max_uses IS NULL THEN NULL
      ELSE GREATEST(0, mc.free_shipping_max_uses - COALESCE((
        SELECT COUNT(*)::int
        FROM public.loyalty_free_shipping_usage f
        WHERE f.card_id = uc.id
          AND f.used_at >= cy.cycle_start
          AND f.used_at <  cy.cycle_end
      ), 0))
    END AS free_shipping_remaining_in_cycle
  FROM public.user_cards uc
  JOIN public.membership_cards mc ON mc.id = uc.card_id
  LEFT JOIN public.profiles p ON p.id = uc.user_id
  CROSS JOIN LATERAL public.get_user_card_cycle(uc.id) cy
  WHERE (NOT p_only_active OR uc.is_active = true)
    AND (p_min_duration_days IS NULL OR COALESCE(mc.duration_days, 30) >= p_min_duration_days)
    AND (
      p_search IS NULL OR p_search = '' OR
      p.username ILIKE '%' || p_search || '%' OR
      p.full_name ILIKE '%' || p_search || '%' OR
      uc.user_id::text = p_search
    )
  ORDER BY uc.purchased_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_user_card_cycles_summary(text, integer, boolean) TO authenticated;