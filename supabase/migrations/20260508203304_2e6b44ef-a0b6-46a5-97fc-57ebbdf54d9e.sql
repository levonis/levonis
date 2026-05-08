CREATE OR REPLACE FUNCTION public.admin_delete_product(_product_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_orders int;
  v_competitions int;
  v_comp_prizes int;
  v_letter_redemptions int;
  v_purchased int;
  v_parts_disc int;
  v_special_coupons int;
  v_giveaways int;
  v_msg text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
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