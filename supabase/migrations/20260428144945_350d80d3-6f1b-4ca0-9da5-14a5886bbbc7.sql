-- Add applicable category whitelists for warranty benefits
ALTER TABLE public.printer_warranty_benefits
  ADD COLUMN IF NOT EXISTS discount_applicable_category_ids uuid[],
  ADD COLUMN IF NOT EXISTS free_shipping_applicable_category_ids uuid[];

-- Add applicable category whitelists for loyalty levels (cards)
ALTER TABLE public.loyalty_levels
  ADD COLUMN IF NOT EXISTS discount_applicable_category_ids uuid[],
  ADD COLUMN IF NOT EXISTS free_shipping_applicable_category_ids uuid[];

-- Update RPC to also return the new arrays (drop+create, return type changed)
DROP FUNCTION IF EXISTS public.get_active_warranty_benefits_for_user(uuid);

CREATE FUNCTION public.get_active_warranty_benefits_for_user(p_user_id uuid)
RETURNS TABLE(
  user_printer_id uuid,
  store_printer_id uuid,
  product_id uuid,
  model_name_ar text,
  serial_number text,
  activation_date timestamp with time zone,
  expiry_date timestamp with time zone,
  is_benefits_active boolean,
  discount_percentage numeric,
  discount_max_amount_monthly numeric,
  free_shipping_max_uses_monthly integer,
  free_shipping_min_order numeric,
  free_shipping_methods jsonb,
  period_start timestamp with time zone,
  period_end timestamp with time zone,
  discount_used numeric,
  free_shipping_used integer,
  discount_applicable_category_ids uuid[],
  free_shipping_applicable_category_ids uuid[]
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    public.get_warranty_free_shipping_used(up.id) AS free_shipping_used,
    pwb.discount_applicable_category_ids,
    pwb.free_shipping_applicable_category_ids
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
$function$;