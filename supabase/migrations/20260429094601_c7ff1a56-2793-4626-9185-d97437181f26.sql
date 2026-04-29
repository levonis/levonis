CREATE OR REPLACE FUNCTION public.consume_subscription_benefit(
  p_subscription_id uuid,
  p_order_id uuid,
  p_benefit_type text,
  p_amount numeric,
  p_delivery_method_key text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_owner uuid;
  v_user_printer_id uuid;
  v_plan_id uuid;
  v_status text;
  v_waiting_ends timestamptz;
  v_end_date timestamptz;
  v_disc_max numeric;
  v_ship_max integer;
  v_period_start timestamptz := date_trunc('month', now());
  v_period_end timestamptz := (date_trunc('month', now()) + interval '1 month');
  v_disc_used numeric;
  v_ship_used integer;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT ps.user_id, ps.user_printer_id, ps.plan_id, ps.status,
         ps.waiting_period_ends_at, ps.end_date
    INTO v_owner, v_user_printer_id, v_plan_id, v_status, v_waiting_ends, v_end_date
  FROM public.printer_subscriptions ps
  WHERE ps.id = p_subscription_id;

  IF v_owner IS NULL OR v_owner <> v_user_id THEN
    RAISE EXCEPTION 'Subscription not found or not owned by user';
  END IF;
  IF v_status <> 'active' THEN
    RAISE EXCEPTION 'Subscription not active';
  END IF;
  IF v_waiting_ends IS NOT NULL AND v_waiting_ends > now() THEN
    RAISE EXCEPTION 'Subscription is still in waiting period';
  END IF;
  IF v_end_date IS NOT NULL AND v_end_date <= now() THEN
    RAISE EXCEPTION 'Subscription has ended';
  END IF;

  SELECT COALESCE(benefit_discount_max_amount_monthly, 0),
         COALESCE(benefit_free_shipping_max_monthly, 0)
    INTO v_disc_max, v_ship_max
  FROM public.protection_plans
  WHERE id = v_plan_id;

  IF p_benefit_type = 'discount' THEN
    SELECT COALESCE(SUM(saved_amount), 0) INTO v_disc_used
    FROM public.subscription_benefit_usage
    WHERE subscription_id = p_subscription_id
      AND benefit_type = 'discount'
      AND used_at >= v_period_start
      AND used_at < v_period_end;
    IF v_disc_used + p_amount > v_disc_max THEN
      RAISE EXCEPTION 'Monthly discount cap exceeded';
    END IF;
  ELSIF p_benefit_type = 'free_shipping' THEN
    SELECT COUNT(*)::int INTO v_ship_used
    FROM public.subscription_benefit_usage
    WHERE subscription_id = p_subscription_id
      AND benefit_type = 'free_shipping'
      AND used_at >= v_period_start
      AND used_at < v_period_end;
    IF v_ship_used + 1 > v_ship_max THEN
      RAISE EXCEPTION 'Monthly free shipping limit exceeded';
    END IF;
  ELSE
    RAISE EXCEPTION 'Invalid benefit_type';
  END IF;

  INSERT INTO public.subscription_benefit_usage (
    subscription_id, user_printer_id, user_id, order_id,
    benefit_type, saved_amount, delivery_method_key
  ) VALUES (
    p_subscription_id, v_user_printer_id, v_user_id, p_order_id,
    p_benefit_type, COALESCE(p_amount, 0), p_delivery_method_key
  );

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_subscription_benefit(uuid, uuid, text, numeric, text) TO authenticated;