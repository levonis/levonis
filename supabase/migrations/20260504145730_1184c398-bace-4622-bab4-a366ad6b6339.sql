DO $$
DECLARE
  safe_cols text;
BEGIN
  EXECUTE 'REVOKE SELECT ON public.orders FROM anon, authenticated';
  EXECUTE 'REVOKE SELECT ON public.order_items FROM anon, authenticated';

  SELECT string_agg(quote_ident(column_name), ', ')
    INTO safe_cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'orders'
    AND column_name NOT IN (
      'profit_amount', 'admin_product_cost', 'admin_shipping_cost',
      'admin_other_costs', 'financial_notes', 'internal_notes'
    );
  EXECUTE format('GRANT SELECT (%s) ON public.orders TO authenticated', safe_cols);

  SELECT string_agg(quote_ident(column_name), ', ')
    INTO safe_cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'order_items'
    AND column_name NOT IN ('cost_price');
  EXECUTE format('GRANT SELECT (%s) ON public.order_items TO authenticated', safe_cols);
END $$;

-- Admin RPC: full orders access
CREATE OR REPLACE FUNCTION public.admin_get_orders_full(p_order_ids uuid[] DEFAULT NULL)
RETURNS SETOF public.orders
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;
  IF p_order_ids IS NULL THEN
    RETURN QUERY SELECT * FROM public.orders ORDER BY created_at DESC LIMIT 1000;
  ELSE
    RETURN QUERY SELECT * FROM public.orders WHERE id = ANY(p_order_ids);
  END IF;
END; $$;

REVOKE EXECUTE ON FUNCTION public.admin_get_orders_full(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_orders_full(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_order_items_full(p_order_ids uuid[])
RETURNS SETOF public.order_items
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;
  RETURN QUERY SELECT * FROM public.order_items WHERE order_id = ANY(p_order_ids);
END; $$;

REVOKE EXECUTE ON FUNCTION public.admin_get_order_items_full(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_order_items_full(uuid[]) TO authenticated;