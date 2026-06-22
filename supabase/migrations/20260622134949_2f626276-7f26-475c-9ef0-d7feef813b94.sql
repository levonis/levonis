CREATE OR REPLACE FUNCTION public.admin_update_product(_updates jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
  v_payload jsonb;
  v_id_text text;
BEGIN
  IF _updates IS NULL OR jsonb_typeof(_updates) <> 'object' THEN
    RAISE EXCEPTION 'admin_update_product: _updates must be a JSON object' USING ERRCODE = '22023';
  END IF;

  IF _updates ? 'id' THEN
    v_id_text := NULLIF(_updates->>'id', '');
    v_payload := _updates - 'id' - 'product_id' - '_product_id';
  ELSIF _updates ? 'product_id' THEN
    v_id_text := NULLIF(_updates->>'product_id', '');
    v_payload := _updates - 'product_id' - '_product_id';
  ELSIF (_updates ? '_product_id') AND (_updates ? '_updates') THEN
    v_id_text := NULLIF(_updates->>'_product_id', '');
    v_payload := _updates->'_updates';
  ELSIF _updates ? '_product_id' THEN
    v_id_text := NULLIF(_updates->>'_product_id', '');
    v_payload := _updates - '_product_id';
  ELSE
    RAISE EXCEPTION 'admin_update_product: product id missing. received keys: %', (SELECT string_agg(k, ', ') FROM jsonb_object_keys(_updates) k)
      USING ERRCODE = '22023';
  END IF;

  IF v_id_text IS NULL THEN
    RAISE EXCEPTION 'admin_update_product: product id is empty/invalid' USING ERRCODE = '22023';
  END IF;

  BEGIN
    v_id := v_id_text::uuid;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'admin_update_product: product id is not a valid uuid (%)', v_id_text USING ERRCODE = '22023';
  END;

  IF v_payload IS NULL OR jsonb_typeof(v_payload) <> 'object' THEN
    RAISE EXCEPTION 'admin_update_product: update payload must be a JSON object' USING ERRCODE = '22023';
  END IF;

  PERFORM public.admin_update_product(v_id, v_payload);
END;
$function$;