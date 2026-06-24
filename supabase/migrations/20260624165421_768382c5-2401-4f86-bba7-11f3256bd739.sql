
CREATE OR REPLACE FUNCTION public.admin_sync_product_options(
  _product_id uuid,
  _options jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  rec jsonb;
BEGIN
  IF NOT public.has_admin_access(auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;

  IF _product_id IS NULL THEN
    RAISE EXCEPTION 'admin_sync_product_options: product_id is required' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.product_options WHERE product_id = _product_id;

  IF _options IS NULL OR jsonb_typeof(_options) <> 'array' THEN
    RETURN;
  END IF;

  FOR rec IN SELECT * FROM jsonb_array_elements(_options)
  LOOP
    INSERT INTO public.product_options (
      product_id,
      name,
      name_ar,
      name_en,
      name_ku,
      price_adjustment,
      in_stock,
      image_url,
      stock_quantity,
      available_for_direct_sale,
      available_for_pre_order,
      cost_usd,
      cost_iqd,
      taobao_sku_id
    ) VALUES (
      _product_id,
      NULLIF(rec->>'name', ''),
      NULLIF(rec->>'name_ar', ''),
      NULLIF(rec->>'name_en', ''),
      NULLIF(rec->>'name_ku', ''),
      COALESCE((rec->>'price_adjustment')::numeric, 0),
      COALESCE((rec->>'in_stock')::boolean, true),
      NULLIF(rec->>'image_url', ''),
      NULLIF(rec->>'stock_quantity', '')::integer,
      COALESCE((rec->>'available_for_direct_sale')::boolean, true),
      COALESCE((rec->>'available_for_pre_order')::boolean, false),
      COALESCE((rec->>'cost_usd')::numeric, 0),
      COALESCE((rec->>'cost_iqd')::numeric, 0),
      NULLIF(rec->>'taobao_sku_id', '')
    );
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_sync_product_options(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_sync_product_options(uuid, jsonb) TO authenticated, service_role;
