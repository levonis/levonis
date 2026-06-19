-- Compatibility overload: some clients/cache reference admin_update_product(_updates jsonb).
-- Read id from inside _updates and delegate to the canonical (_product_id, _updates) function.
CREATE OR REPLACE FUNCTION public.admin_update_product(_updates jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_payload jsonb;
BEGIN
  IF _updates IS NULL OR jsonb_typeof(_updates) <> 'object' THEN
    RAISE EXCEPTION 'admin_update_product: _updates must be a JSON object' USING ERRCODE = '22023';
  END IF;
  IF NOT (_updates ? 'id') THEN
    RAISE EXCEPTION 'admin_update_product: _updates.id is required for single-arg overload' USING ERRCODE = '22023';
  END IF;
  v_id := (_updates->>'id')::uuid;
  v_payload := _updates - 'id';
  PERFORM public.admin_update_product(v_id, v_payload);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_product(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_product(jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';