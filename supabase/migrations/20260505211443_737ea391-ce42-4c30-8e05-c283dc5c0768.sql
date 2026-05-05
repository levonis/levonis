CREATE OR REPLACE FUNCTION public.check_user_printer_warranty()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_has_active boolean;
  v_has_any boolean;
  v_has_expired boolean;
  v_latest_expiry timestamptz;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('status','auth_required');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.store_printers
    WHERE buyer_user_id = v_user
      AND COALESCE(status,'active') = 'active'
      AND expiry_date IS NOT NULL
      AND expiry_date > now()
  ) INTO v_has_active;

  IF v_has_active THEN
    SELECT MAX(expiry_date) INTO v_latest_expiry
    FROM public.store_printers
    WHERE buyer_user_id = v_user
      AND COALESCE(status,'active') = 'active'
      AND expiry_date > now();
    RETURN jsonb_build_object('status','active','expiry_date', v_latest_expiry);
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.store_printers WHERE buyer_user_id = v_user) INTO v_has_any;
  SELECT EXISTS(
    SELECT 1 FROM public.store_printers
    WHERE buyer_user_id = v_user
      AND expiry_date IS NOT NULL
      AND expiry_date <= now()
  ) INTO v_has_expired;

  IF NOT v_has_any THEN
    RETURN jsonb_build_object('status','no_printer_registered');
  ELSIF v_has_expired THEN
    RETURN jsonb_build_object('status','warranty_expired');
  ELSE
    RETURN jsonb_build_object('status','no_active_warranty');
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_user_printer_warranty() TO authenticated;