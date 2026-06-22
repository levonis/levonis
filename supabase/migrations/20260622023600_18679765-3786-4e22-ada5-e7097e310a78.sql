CREATE OR REPLACE FUNCTION public.admin_quick_update_costs(
  _product_id uuid,
  _product_cost numeric,
  _options jsonb,
  _original_price_usd numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  o jsonb;
  option_cost numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.products
  SET cost_price = _product_cost,
      original_price_usd = _original_price_usd,
      is_pricing_updated = true,
      last_price_update = now()
  WHERE id = _product_id;

  IF _options IS NOT NULL THEN
    FOR o IN SELECT * FROM jsonb_array_elements(_options)
    LOOP
      option_cost := NULLIF(o->>'cost', '')::numeric;

      UPDATE public.product_options
      SET price_adjustment = option_cost,
          cost_iqd = option_cost
      WHERE id = (o->>'id')::uuid
        AND product_id = _product_id;
    END LOOP;
  END IF;
END;
$function$;