-- 1. إضافة أعمدة الفوائد إلى protection_plans
ALTER TABLE public.protection_plans
  ADD COLUMN IF NOT EXISTS benefit_discount_percentage numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS benefit_discount_max_amount_monthly numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS benefit_discount_category_ids uuid[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS benefit_free_shipping_max_monthly integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS benefit_free_shipping_min_order numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS benefit_free_shipping_methods jsonb NOT NULL DEFAULT '["standard"]'::jsonb,
  ADD COLUMN IF NOT EXISTS benefit_free_shipping_category_ids uuid[] DEFAULT NULL;

-- 2. جدول استخدام فوائد الاشتراك (مرآة لـ printer_warranty_usage)
CREATE TABLE IF NOT EXISTS public.subscription_benefit_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.printer_subscriptions(id) ON DELETE CASCADE,
  user_printer_id uuid NOT NULL REFERENCES public.user_printers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  order_id uuid NOT NULL,
  benefit_type text NOT NULL CHECK (benefit_type IN ('discount','free_shipping')),
  saved_amount numeric NOT NULL DEFAULT 0,
  delivery_method_key text,
  used_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sbu_user ON public.subscription_benefit_usage (user_id, used_at);
CREATE INDEX IF NOT EXISTS idx_sbu_subscription ON public.subscription_benefit_usage (subscription_id, used_at);
CREATE INDEX IF NOT EXISTS idx_sbu_user_printer ON public.subscription_benefit_usage (user_printer_id, used_at);
CREATE INDEX IF NOT EXISTS idx_sbu_order ON public.subscription_benefit_usage (order_id);

ALTER TABLE public.subscription_benefit_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own subscription benefit usage" ON public.subscription_benefit_usage;
CREATE POLICY "Users view own subscription benefit usage"
  ON public.subscription_benefit_usage
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins view all subscription benefit usage" ON public.subscription_benefit_usage;
CREATE POLICY "Admins view all subscription benefit usage"
  ON public.subscription_benefit_usage
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins insert subscription benefit usage" ON public.subscription_benefit_usage;
CREATE POLICY "Admins insert subscription benefit usage"
  ON public.subscription_benefit_usage
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR auth.uid() = user_id);

-- 3. RPC: جلب فوائد كل اشتراك نشط للمستخدم مع الاستخدام الشهري الحالي
CREATE OR REPLACE FUNCTION public.get_active_subscription_benefits_for_user(p_user_id uuid)
RETURNS TABLE (
  subscription_id uuid,
  user_printer_id uuid,
  store_printer_id uuid,
  product_id uuid,
  model_name_ar text,
  serial_number text,
  plan_id uuid,
  plan_name_ar text,
  plan_badge_text text,
  start_date timestamptz,
  end_date timestamptz,
  is_benefits_active boolean,
  discount_percentage numeric,
  discount_max_amount_monthly numeric,
  free_shipping_max_uses_monthly integer,
  free_shipping_min_order numeric,
  free_shipping_methods jsonb,
  period_start timestamptz,
  period_end timestamptz,
  discount_used numeric,
  free_shipping_used integer,
  discount_applicable_category_ids uuid[],
  free_shipping_applicable_category_ids uuid[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_start timestamptz := date_trunc('month', now());
  v_period_end   timestamptz := (date_trunc('month', now()) + interval '1 month');
BEGIN
  RETURN QUERY
  SELECT
    ps.id AS subscription_id,
    up.id AS user_printer_id,
    sp.id AS store_printer_id,
    sp.product_id,
    sp.model_name_ar,
    sp.serial_number,
    pp.id AS plan_id,
    pp.name_ar AS plan_name_ar,
    pp.badge_text AS plan_badge_text,
    ps.start_date,
    ps.end_date,
    (
      ps.status = 'active'
      AND (ps.waiting_period_ends_at IS NULL OR ps.waiting_period_ends_at <= now())
      AND (ps.end_date IS NULL OR ps.end_date > now())
    ) AS is_benefits_active,
    COALESCE(pp.benefit_discount_percentage, 0)::numeric AS discount_percentage,
    COALESCE(pp.benefit_discount_max_amount_monthly, 0)::numeric AS discount_max_amount_monthly,
    COALESCE(pp.benefit_free_shipping_max_monthly, 0)::integer AS free_shipping_max_uses_monthly,
    COALESCE(pp.benefit_free_shipping_min_order, 0)::numeric AS free_shipping_min_order,
    COALESCE(pp.benefit_free_shipping_methods, '["standard"]'::jsonb) AS free_shipping_methods,
    v_period_start AS period_start,
    v_period_end AS period_end,
    COALESCE((
      SELECT SUM(u.saved_amount)
      FROM public.subscription_benefit_usage u
      WHERE u.subscription_id = ps.id
        AND u.benefit_type = 'discount'
        AND u.used_at >= v_period_start
        AND u.used_at < v_period_end
    ), 0)::numeric AS discount_used,
    COALESCE((
      SELECT COUNT(*)::integer
      FROM public.subscription_benefit_usage u
      WHERE u.subscription_id = ps.id
        AND u.benefit_type = 'free_shipping'
        AND u.used_at >= v_period_start
        AND u.used_at < v_period_end
    ), 0)::integer AS free_shipping_used,
    pp.benefit_discount_category_ids AS discount_applicable_category_ids,
    pp.benefit_free_shipping_category_ids AS free_shipping_applicable_category_ids
  FROM public.printer_subscriptions ps
  JOIN public.user_printers up ON up.id = ps.user_printer_id
  JOIN public.store_printers sp ON sp.id = up.store_printer_id
  JOIN public.protection_plans pp ON pp.id = ps.plan_id
  WHERE ps.user_id = p_user_id
    AND ps.status = 'active';
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_subscription_benefits_for_user(uuid) TO authenticated;