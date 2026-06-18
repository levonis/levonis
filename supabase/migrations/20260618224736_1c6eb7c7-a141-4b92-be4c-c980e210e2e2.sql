
-- Allow assistants to create and delete products (update already uses has_admin_access)
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
    'cost_price','commission_iqd','other_costs_iqd',
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

  -- Assistants cannot set financial/pricing fields directly
  IF NOT is_strict_admin THEN
    FOREACH k IN ARRAY forbidden LOOP payload := payload - k; END LOOP;
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

CREATE OR REPLACE FUNCTION public.admin_delete_product(_product_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_orders int;
  v_competitions int;
  v_letter_redemptions int;
  v_purchased int;
  v_parts_disc int;
  v_special_coupons int;
  v_giveaways int;
  v_msg text;
BEGIN
  IF NOT public.has_admin_access(auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_orders FROM public.order_items WHERE product_id = _product_id;
  SELECT count(*) INTO v_competitions FROM public.competitions WHERE product_id = _product_id OR prize_product_id = _product_id;
  SELECT count(*) INTO v_letter_redemptions FROM public.letter_prize_redemptions WHERE product_id = _product_id;
  SELECT count(*) INTO v_purchased FROM public.user_purchased_products WHERE product_id = _product_id;
  SELECT count(*) INTO v_parts_disc FROM public.parts_discount_requests WHERE product_id = _product_id;
  SELECT count(*) INTO v_special_coupons FROM public.customer_special_coupons WHERE product_id = _product_id;
  SELECT count(*) INTO v_giveaways FROM public.merchant_giveaways WHERE product_id = _product_id;

  IF v_orders > 0 OR v_competitions > 0 OR v_letter_redemptions > 0 OR v_purchased > 0
     OR v_parts_disc > 0 OR v_special_coupons > 0 OR v_giveaways > 0 THEN
    v_msg := 'لا يمكن حذف هذا المنتج لأنه مرتبط بـ: ';
    IF v_orders > 0 THEN v_msg := v_msg || 'طلبات (' || v_orders || ') '; END IF;
    IF v_competitions > 0 THEN v_msg := v_msg || 'مسابقات (' || v_competitions || ') '; END IF;
    IF v_letter_redemptions > 0 THEN v_msg := v_msg || 'استبدال جوائز (' || v_letter_redemptions || ') '; END IF;
    IF v_purchased > 0 THEN v_msg := v_msg || 'مشتريات مستخدمين (' || v_purchased || ') '; END IF;
    IF v_parts_disc > 0 THEN v_msg := v_msg || 'طلبات خصم قطع (' || v_parts_disc || ') '; END IF;
    IF v_special_coupons > 0 THEN v_msg := v_msg || 'كوبونات خاصة (' || v_special_coupons || ') '; END IF;
    IF v_giveaways > 0 THEN v_msg := v_msg || 'هدايا تجار (' || v_giveaways || ') '; END IF;
    v_msg := v_msg || '. أخفِ المنتج بدلاً من حذفه.';
    RAISE EXCEPTION '%', v_msg USING ERRCODE = 'P0001';
  END IF;

  BEGIN
    DELETE FROM public.products WHERE id = _product_id;
  EXCEPTION WHEN foreign_key_violation THEN
    RAISE EXCEPTION 'لا يمكن حذف هذا المنتج لأنه مرتبط بسجلات أخرى. يُفضّل إخفاء المنتج بدل حذفه. (%) ', SQLERRM USING ERRCODE = 'P0001';
  END;
END;
$function$;
