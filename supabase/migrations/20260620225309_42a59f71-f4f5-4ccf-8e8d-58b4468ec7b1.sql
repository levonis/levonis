
-- Allow assistants to save cost_price so admins can see their cost entries.
-- Remove cost_price from the forbidden list in both admin_create_product and admin_update_product.

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
  is_strict_admin boolean;
  forbidden text[] := ARRAY[
    'commission_iqd','other_costs_iqd',
    'commission_sea_iqd','commission_air_iqd','commission_direct_iqd',
    'shipping_cost_iqd','personal_delivery_cost','referral_earnings_iqd',
    'sea_price','air_price','direct_sale_price','round_up_price','price_usd','original_price_usd'
  ];
  k text;
BEGIN
  IF NOT public.has_admin_access(auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  is_strict_admin := public.has_role(auth.uid(), 'admin'::public.app_role);
  payload := public._admin_filtered_payload('products', _updates, ARRAY['id','created_at']::text[]);
  IF NOT is_strict_admin THEN
    FOREACH k IN ARRAY forbidden LOOP payload := payload - k; END LOOP;
  END IF;
  SELECT array_agg(key) INTO cols FROM jsonb_object_keys(payload) AS key;
  IF cols IS NULL OR array_length(cols, 1) IS NULL THEN RETURN; END IF;
  SELECT string_agg(format('%1$I = (s.r).%1$I', col), ', ') INTO set_clause FROM unnest(cols) AS col;
  EXECUTE format(
    'UPDATE public.products AS t SET %s FROM (SELECT jsonb_populate_record(NULL::public.products, $1) AS r) AS s WHERE t.id = $2',
    set_clause
  ) USING payload, _product_id;
END;
$function$;

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
  forbidden text[] := ARRAY[
    'commission_iqd','other_costs_iqd',
    'commission_sea_iqd','commission_air_iqd','commission_direct_iqd',
    'shipping_cost_iqd','personal_delivery_cost','referral_earnings_iqd',
    'sea_price','air_price','direct_sale_price','round_up_price','price_usd','original_price_usd'
  ];
  k text;
BEGIN
  IF NOT public.has_admin_access(auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;

  is_strict_admin := public.has_role(auth.uid(), 'admin'::public.app_role);
  payload := public._admin_filtered_payload('products', _values, ARRAY['id','created_at']::text[]);

  IF NOT is_strict_admin THEN
    FOREACH k IN ARRAY forbidden LOOP payload := payload - k; END LOOP;
    payload := payload
      || jsonb_build_object(
        'pending_admin_review', true,
        'is_pricing_updated', false,
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

NOTIFY pgrst, 'reload schema';
