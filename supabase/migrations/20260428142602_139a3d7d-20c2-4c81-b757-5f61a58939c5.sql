-- Settings table: warranty benefits per printer product
CREATE TABLE IF NOT EXISTS public.printer_warranty_benefits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL UNIQUE REFERENCES public.products(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  discount_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  discount_max_amount_monthly NUMERIC NOT NULL DEFAULT 0,
  free_shipping_max_uses_monthly INTEGER NOT NULL DEFAULT 0,
  free_shipping_min_order NUMERIC NOT NULL DEFAULT 0,
  free_shipping_methods JSONB NOT NULL DEFAULT '["standard"]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.printer_warranty_benefits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view warranty benefit settings"
  ON public.printer_warranty_benefits FOR SELECT
  USING (true);

CREATE POLICY "Admins manage warranty benefit settings"
  ON public.printer_warranty_benefits FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_printer_warranty_benefits_updated_at
  BEFORE UPDATE ON public.printer_warranty_benefits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Usage log
CREATE TABLE IF NOT EXISTS public.printer_warranty_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_printer_id UUID NOT NULL REFERENCES public.user_printers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  order_id UUID NOT NULL,
  benefit_type TEXT NOT NULL CHECK (benefit_type IN ('discount', 'free_shipping')),
  saved_amount NUMERIC NOT NULL DEFAULT 0,
  delivery_method_key TEXT,
  used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_pwu_user_printer ON public.printer_warranty_usage(user_printer_id, used_at);
CREATE INDEX idx_pwu_user ON public.printer_warranty_usage(user_id, used_at);
CREATE INDEX idx_pwu_order ON public.printer_warranty_usage(order_id);

ALTER TABLE public.printer_warranty_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own warranty usage"
  ON public.printer_warranty_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all warranty usage"
  ON public.printer_warranty_usage FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- No direct INSERT/UPDATE/DELETE policies; only SECURITY DEFINER functions write.

-- Period bounds: based on activation day of month
CREATE OR REPLACE FUNCTION public.get_warranty_period_bounds(p_user_printer_id UUID)
RETURNS TABLE(period_start TIMESTAMPTZ, period_end TIMESTAMPTZ)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_activation TIMESTAMPTZ;
  v_day INT;
  v_now TIMESTAMPTZ := now();
  v_start TIMESTAMPTZ;
BEGIN
  SELECT sp.activation_date INTO v_activation
  FROM public.user_printers up
  JOIN public.store_printers sp ON sp.id = up.store_printer_id
  WHERE up.id = p_user_printer_id;

  IF v_activation IS NULL THEN
    RETURN;
  END IF;

  v_day := EXTRACT(DAY FROM v_activation)::INT;

  -- Start = most recent occurrence of v_day at or before now
  v_start := date_trunc('day', make_timestamptz(
    EXTRACT(YEAR FROM v_now)::INT,
    EXTRACT(MONTH FROM v_now)::INT,
    LEAST(v_day, EXTRACT(DAY FROM (date_trunc('month', v_now) + INTERVAL '1 month - 1 day'))::INT),
    0, 0, 0
  ));

  IF v_start > v_now THEN
    v_start := v_start - INTERVAL '1 month';
  END IF;

  period_start := v_start;
  period_end := v_start + INTERVAL '1 month';
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_warranty_discount_used(p_user_printer_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
  v_total NUMERIC;
BEGIN
  SELECT period_start, period_end INTO v_start, v_end
  FROM public.get_warranty_period_bounds(p_user_printer_id);
  IF v_start IS NULL THEN RETURN 0; END IF;

  SELECT COALESCE(SUM(saved_amount), 0) INTO v_total
  FROM public.printer_warranty_usage
  WHERE user_printer_id = p_user_printer_id
    AND benefit_type = 'discount'
    AND used_at >= v_start AND used_at < v_end;
  RETURN v_total;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_warranty_free_shipping_used(p_user_printer_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
  v_count INT;
BEGIN
  SELECT period_start, period_end INTO v_start, v_end
  FROM public.get_warranty_period_bounds(p_user_printer_id);
  IF v_start IS NULL THEN RETURN 0; END IF;

  SELECT COUNT(*)::INT INTO v_count
  FROM public.printer_warranty_usage
  WHERE user_printer_id = p_user_printer_id
    AND benefit_type = 'free_shipping'
    AND used_at >= v_start AND used_at < v_end;
  RETURN v_count;
END;
$$;

-- Returns active warranties + benefit settings + usage for the calling user
CREATE OR REPLACE FUNCTION public.get_active_warranty_benefits_for_user(p_user_id UUID)
RETURNS TABLE(
  user_printer_id UUID,
  store_printer_id UUID,
  product_id UUID,
  model_name_ar TEXT,
  serial_number TEXT,
  activation_date TIMESTAMPTZ,
  expiry_date TIMESTAMPTZ,
  is_benefits_active BOOLEAN,
  discount_percentage NUMERIC,
  discount_max_amount_monthly NUMERIC,
  free_shipping_max_uses_monthly INT,
  free_shipping_min_order NUMERIC,
  free_shipping_methods JSONB,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  discount_used NUMERIC,
  free_shipping_used INT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    up.id AS user_printer_id,
    sp.id AS store_printer_id,
    oi.product_id,
    sp.model_name_ar,
    sp.serial_number,
    sp.activation_date,
    sp.expiry_date,
    COALESCE(pwb.is_active, false) AS is_benefits_active,
    COALESCE(pwb.discount_percentage, 0) AS discount_percentage,
    COALESCE(pwb.discount_max_amount_monthly, 0) AS discount_max_amount_monthly,
    COALESCE(pwb.free_shipping_max_uses_monthly, 0) AS free_shipping_max_uses_monthly,
    COALESCE(pwb.free_shipping_min_order, 0) AS free_shipping_min_order,
    COALESCE(pwb.free_shipping_methods, '["standard"]'::jsonb) AS free_shipping_methods,
    pb.period_start,
    pb.period_end,
    public.get_warranty_discount_used(up.id) AS discount_used,
    public.get_warranty_free_shipping_used(up.id) AS free_shipping_used
  FROM public.user_printers up
  JOIN public.store_printers sp ON sp.id = up.store_printer_id
  LEFT JOIN public.order_items oi ON oi.id = sp.order_item_id
  LEFT JOIN public.printer_warranty_benefits pwb ON pwb.product_id = oi.product_id
  CROSS JOIN LATERAL public.get_warranty_period_bounds(up.id) pb
  WHERE up.user_id = p_user_id
    AND sp.activation_date IS NOT NULL
    AND sp.expiry_date IS NOT NULL
    AND sp.expiry_date > now();
END;
$$;

-- Atomic consumption with cap enforcement
CREATE OR REPLACE FUNCTION public.consume_warranty_benefit(
  p_user_printer_id UUID,
  p_order_id UUID,
  p_benefit_type TEXT,
  p_amount NUMERIC,
  p_delivery_method_key TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_owner UUID;
  v_product_id UUID;
  v_active BOOLEAN;
  v_disc_max NUMERIC;
  v_ship_max INT;
  v_disc_used NUMERIC;
  v_ship_used INT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT up.user_id, oi.product_id INTO v_owner, v_product_id
  FROM public.user_printers up
  JOIN public.store_printers sp ON sp.id = up.store_printer_id
  LEFT JOIN public.order_items oi ON oi.id = sp.order_item_id
  WHERE up.id = p_user_printer_id
    AND sp.activation_date IS NOT NULL
    AND sp.expiry_date > now();

  IF v_owner IS NULL OR v_owner <> v_user_id THEN
    RAISE EXCEPTION 'Warranty not found or not owned by user';
  END IF;

  SELECT is_active, discount_max_amount_monthly, free_shipping_max_uses_monthly
  INTO v_active, v_disc_max, v_ship_max
  FROM public.printer_warranty_benefits
  WHERE product_id = v_product_id;

  IF NOT COALESCE(v_active, false) THEN
    RAISE EXCEPTION 'Warranty benefits not active for this printer';
  END IF;

  IF p_benefit_type = 'discount' THEN
    v_disc_used := public.get_warranty_discount_used(p_user_printer_id);
    IF v_disc_used + p_amount > v_disc_max THEN
      RAISE EXCEPTION 'Monthly discount cap exceeded';
    END IF;
  ELSIF p_benefit_type = 'free_shipping' THEN
    v_ship_used := public.get_warranty_free_shipping_used(p_user_printer_id);
    IF v_ship_used + 1 > v_ship_max THEN
      RAISE EXCEPTION 'Monthly free shipping limit exceeded';
    END IF;
  ELSE
    RAISE EXCEPTION 'Invalid benefit type';
  END IF;

  INSERT INTO public.printer_warranty_usage(
    user_printer_id, user_id, order_id, benefit_type, saved_amount, delivery_method_key
  ) VALUES (
    p_user_printer_id, v_user_id, p_order_id, p_benefit_type, p_amount, p_delivery_method_key
  );

  RETURN true;
END;
$$;