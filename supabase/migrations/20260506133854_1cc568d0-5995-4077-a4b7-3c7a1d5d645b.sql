CREATE OR REPLACE FUNCTION public.admin_update_order(_order_id uuid, _updates jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payload jsonb;
  cols text[];
  set_clause text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;

  payload := public._admin_filtered_payload('orders', _updates, ARRAY['id','created_at','order_number','user_id']::text[]);
  SELECT array_agg(key) INTO cols FROM jsonb_object_keys(payload) AS key;
  IF cols IS NULL OR array_length(cols, 1) IS NULL THEN
    RETURN;
  END IF;

  SELECT string_agg(format('%1$I = (s.r).%1$I', col), ', ')
  INTO set_clause
  FROM unnest(cols) AS col;

  EXECUTE format(
    'UPDATE public.orders AS t SET %s FROM (SELECT jsonb_populate_record(NULL::public.orders, $1) AS r) AS s WHERE t.id = $2',
    set_clause
  ) USING payload, _order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_create_order(_values jsonb)
RETURNS TABLE(id uuid, order_number text, status text, total_amount numeric, user_id uuid, created_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payload jsonb;
  cols text[];
  col_list text;
  val_list text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;

  payload := public._admin_filtered_payload('orders', _values, ARRAY['id','created_at']::text[]);
  SELECT array_agg(key) INTO cols FROM jsonb_object_keys(payload) AS key;
  IF cols IS NULL OR array_length(cols, 1) IS NULL THEN
    RAISE EXCEPTION 'No valid order fields supplied';
  END IF;

  SELECT string_agg(format('%I', col), ', '), string_agg(format('(s.r).%I', col), ', ')
  INTO col_list, val_list
  FROM unnest(cols) AS col;

  RETURN QUERY EXECUTE format(
    'INSERT INTO public.orders (%s) SELECT %s FROM (SELECT jsonb_populate_record(NULL::public.orders, $1) AS r) AS s RETURNING id, order_number, status, total_amount, user_id, created_at',
    col_list,
    val_list
  ) USING payload;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_product(_product_id uuid, _updates jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payload jsonb;
  cols text[];
  set_clause text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;

  payload := public._admin_filtered_payload('products', _updates, ARRAY['id','created_at']::text[]);
  SELECT array_agg(key) INTO cols FROM jsonb_object_keys(payload) AS key;
  IF cols IS NULL OR array_length(cols, 1) IS NULL THEN
    RETURN;
  END IF;

  SELECT string_agg(format('%1$I = (s.r).%1$I', col), ', ')
  INTO set_clause
  FROM unnest(cols) AS col;

  EXECUTE format(
    'UPDATE public.products AS t SET %s FROM (SELECT jsonb_populate_record(NULL::public.products, $1) AS r) AS s WHERE t.id = $2',
    set_clause
  ) USING payload, _product_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_create_product(_values jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payload jsonb;
  cols text[];
  col_list text;
  val_list text;
  new_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;

  payload := public._admin_filtered_payload('products', _values, ARRAY['id','created_at']::text[]);
  SELECT array_agg(key) INTO cols FROM jsonb_object_keys(payload) AS key;
  IF cols IS NULL OR array_length(cols, 1) IS NULL THEN
    RAISE EXCEPTION 'No valid product fields supplied';
  END IF;

  SELECT string_agg(format('%I', col), ', '), string_agg(format('(s.r).%I', col), ', ')
  INTO col_list, val_list
  FROM unnest(cols) AS col;

  EXECUTE format(
    'INSERT INTO public.products (%s) SELECT %s FROM (SELECT jsonb_populate_record(NULL::public.products, $1) AS r) AS s RETURNING id',
    col_list,
    val_list
  ) INTO new_id USING payload;

  RETURN new_id;
END;
$$;
