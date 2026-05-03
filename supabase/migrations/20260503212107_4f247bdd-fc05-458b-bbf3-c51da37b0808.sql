CREATE OR REPLACE FUNCTION public.reveal_random_filament_orders(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_owner uuid;
BEGIN
  SELECT user_id INTO v_owner FROM public.orders WHERE id = p_order_id;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;
  IF v_owner <> v_user AND NOT public.has_role(v_user,'admin') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  UPDATE public.random_filament_orders rfo
  SET order_id = p_order_id,
      revealed_at = COALESCE(revealed_at, now())
  FROM public.order_items oi, public.products p
  WHERE oi.order_id = p_order_id
    AND oi.product_id = rfo.product_id
    AND COALESCE(oi.product_option_id::text,'') = COALESCE(rfo.product_option_id::text,'')
    AND rfo.user_id = v_owner
    AND rfo.order_id IS NULL
    AND p.id = rfo.product_id;

  UPDATE public.order_items oi
  SET product_name = COALESCE(p.name, oi.product_name),
      product_name_ar = COALESCE(p.name_ar, oi.product_name_ar),
      selected_color = COALESCE(rfo.selected_color, oi.selected_color)
  FROM public.random_filament_orders rfo
  JOIN public.products p ON p.id = rfo.product_id
  WHERE rfo.order_id = p_order_id
    AND oi.order_id = p_order_id
    AND oi.product_id = rfo.product_id
    AND COALESCE(oi.product_option_id::text,'') = COALESCE(rfo.product_option_id::text,'');
END;
$$;