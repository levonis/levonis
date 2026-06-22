DROP FUNCTION IF EXISTS public.admin_quick_update_costs(uuid, numeric, jsonb, numeric);

CREATE OR REPLACE FUNCTION public.admin_quick_update_costs(
  _product_id uuid,
  _product_cost numeric,
  _options jsonb,
  _original_price_usd numeric DEFAULT NULL
)
RETURNS TABLE(cost_price numeric, original_price_usd numeric)
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

  RETURN QUERY
  UPDATE public.products AS p
  SET cost_price = _product_cost,
      original_price_usd = CASE
        WHEN _product_cost IS NULL THEN NULL
        ELSE COALESCE(_original_price_usd, p.original_price_usd)
      END,
      is_pricing_updated = true,
      last_price_update = now()
  WHERE p.id = _product_id
  RETURNING p.cost_price, p.original_price_usd;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product cost was not updated';
  END IF;

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

GRANT EXECUTE ON FUNCTION public.admin_quick_update_costs(uuid, numeric, jsonb, numeric) TO authenticated;