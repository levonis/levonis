CREATE OR REPLACE FUNCTION public.admin_update_product(_updates jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_payload jsonb;
BEGIN
  IF _updates IS NULL OR jsonb_typeof(_updates) <> 'object' THEN
    RAISE EXCEPTION 'admin_update_product: _updates must be a JSON object' USING ERRCODE = '22023';
  END IF;

  -- Accept the intended compatibility shape: { id, ...fields }
  IF _updates ? 'id' THEN
    v_id := (_updates->>'id')::uuid;
    v_payload := _updates - 'id';
  -- Also accept the two-argument RPC body if PostgREST routes it to this JSONB overload:
  -- { _product_id: uuid, _updates: { ...fields } }
  ELSIF (_updates ? '_product_id') AND (_updates ? '_updates') THEN
    v_id := (_updates->>'_product_id')::uuid;
    v_payload := _updates->'_updates';
  -- Accept a defensive alias used by some generated clients.
  ELSIF (_updates ? 'product_id') THEN
    v_id := (_updates->>'product_id')::uuid;
    v_payload := _updates - 'product_id';
  ELSE
    RAISE EXCEPTION 'admin_update_product: product id is required for single-arg overload' USING ERRCODE = '22023';
  END IF;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'admin_update_product: product id is invalid' USING ERRCODE = '22023';
  END IF;
  IF v_payload IS NULL OR jsonb_typeof(v_payload) <> 'object' THEN
    RAISE EXCEPTION 'admin_update_product: update payload must be a JSON object' USING ERRCODE = '22023';
  END IF;

  PERFORM public.admin_update_product(v_id, v_payload);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_product(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_product(jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';