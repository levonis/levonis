CREATE OR REPLACE FUNCTION public.admin_create_product(_values jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  payload jsonb;
  cols text[];
  col_list text;
  val_list text;
  new_id uuid;
  is_strict_admin boolean;
BEGIN
  IF NOT public.has_admin_access(auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;

  is_strict_admin := public.has_role(auth.uid(), 'admin'::public.app_role);
  payload := public._admin_filtered_payload('products', _values, ARRAY['id','created_at']::text[]);

  IF NOT is_strict_admin THEN
    -- Assistants can now persist pricing/shipping/dimensions fields the UI computes,
    -- but products still enter the admin-review queue.
    payload := payload
      || jsonb_build_object(
        'pending_admin_review', true,
        'created_by_assistant', auth.uid()
      );
  END IF;

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
$function$;

CREATE OR REPLACE FUNCTION public.admin_update_product(_product_id uuid, _updates jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  payload jsonb;
  cols text[];
  set_clause text;
BEGIN
  IF NOT public.has_admin_access(auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;

  -- Both admins and assistants may now persist all product fields (including
  -- original_price, original_price_usd, price_usd, dimensions, computed
  -- shipping/sale prices and commissions). Read visibility is still gated by
  -- the products_admin view for non-admins.
  payload := public._admin_filtered_payload('products', _updates, ARRAY['id','created_at']::text[]);

  SELECT array_agg(key) INTO cols FROM jsonb_object_keys(payload) AS key;
  IF cols IS NULL OR array_length(cols, 1) IS NULL THEN RETURN; END IF;
  SELECT string_agg(format('%1$I = (s.r).%1$I', col), ', ') INTO set_clause FROM unnest(cols) AS col;
  EXECUTE format(
    'UPDATE public.products AS t SET %s FROM (SELECT jsonb_populate_record(NULL::public.products, $1) AS r) AS s WHERE t.id = $2',
    set_clause
  ) USING payload, _product_id;
END;
$function$;