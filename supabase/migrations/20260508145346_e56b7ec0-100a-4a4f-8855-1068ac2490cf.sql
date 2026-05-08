ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS cod_fee numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.create_order_with_wallet_payment(p_user_id uuid, p_order_data jsonb, p_payment_amount numeric)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_current_balance NUMERIC;
  v_order_id UUID;
  v_order_number TEXT;
  v_transaction_id UUID;
  v_lock_key BIGINT;
  v_remaining NUMERIC;
  v_payment_status TEXT;
  v_requested_payment_status TEXT;
  v_payment_method TEXT;
BEGIN
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'غير مصرح: لا يمكنك إنشاء طلب لمستخدم آخر';
  END IF;

  IF p_payment_amount < 0 THEN
    RAISE EXCEPTION 'المبلغ لا يمكن أن يكون سالباً';
  END IF;

  v_lock_key := ('x' || left(md5(p_user_id::text), 15))::bit(60)::bigint;
  IF NOT pg_try_advisory_xact_lock(v_lock_key) THEN
    RAISE EXCEPTION 'عملية أخرى قيد التنفيذ. حاول مجدداً.';
  END IF;

  IF p_payment_amount > 0 THEN
    SELECT balance INTO v_current_balance
    FROM public.user_wallets
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF v_current_balance IS NULL THEN
      RAISE EXCEPTION 'محفظة المستخدم غير موجودة';
    END IF;

    IF v_current_balance < p_payment_amount THEN
      RAISE EXCEPTION 'رصيد المحفظة غير كافٍ. الرصيد الحالي: % | المطلوب: %', v_current_balance, p_payment_amount;
    END IF;
  END IF;

  SELECT public.generate_order_number() INTO v_order_number;

  v_remaining := COALESCE((p_order_data->>'remaining_amount')::NUMERIC, 0);
  v_payment_method := COALESCE(NULLIF(p_order_data->>'payment_method', ''), CASE WHEN p_payment_amount > 0 THEN 'wallet' ELSE 'cod' END);
  v_requested_payment_status := NULLIF(p_order_data->>'payment_status', '');

  IF v_requested_payment_status IN ('cod', 'partial', 'paid', 'pending') THEN
    v_payment_status := v_requested_payment_status;
  ELSIF v_payment_method = 'cod' THEN
    v_payment_status := 'cod';
  ELSIF v_remaining <= 0 THEN
    v_payment_status := 'paid';
  ELSIF p_payment_amount > 0 THEN
    v_payment_status := 'partial';
  ELSE
    v_payment_status := 'cod';
  END IF;

  INSERT INTO public.orders (
    user_id,
    order_number,
    total_amount,
    subtotal,
    paid_amount,
    remaining_amount,
    cod_fee,
    payment_status,
    payment_method,
    status,
    currency,
    shipping_address,
    phone_number,
    governorate,
    customer_paid_amount,
    delivery_method,
    discount_amount,
    card_discount_amount,
    card_discount_level_name,
    referral_coupon_id,
    referral_owner_earnings_iqd
  ) VALUES (
    p_user_id,
    v_order_number,
    (p_order_data->>'total_amount')::NUMERIC,
    (p_order_data->>'subtotal')::NUMERIC,
    COALESCE((p_order_data->>'paid_amount')::NUMERIC, 0),
    v_remaining,
    GREATEST(0, COALESCE((p_order_data->>'cod_fee')::NUMERIC, 0)),
    v_payment_status,
    v_payment_method,
    'pending',
    'دينار عراقي',
    p_order_data->>'shipping_address',
    p_order_data->>'phone_number',
    p_order_data->>'governorate',
    p_payment_amount,
    COALESCE(NULLIF(p_order_data->>'delivery_method', ''), 'standard'),
    COALESCE((p_order_data->>'discount_amount')::NUMERIC, 0),
    COALESCE((p_order_data->>'card_discount_amount')::NUMERIC, 0),
    NULLIF(p_order_data->>'card_discount_level_name', ''),
    NULLIF(p_order_data->>'referral_coupon_id', '')::UUID,
    COALESCE((p_order_data->>'referral_owner_earnings_iqd')::NUMERIC, 0)
  )
  RETURNING id INTO v_order_id;

  IF p_payment_amount > 0 THEN
    UPDATE public.user_wallets
    SET balance = balance - p_payment_amount,
        updated_at = NOW()
    WHERE user_id = p_user_id;

    INSERT INTO public.wallet_transactions (user_id, type, amount, status, admin_notes)
    VALUES (p_user_id, 'order_payment', -p_payment_amount, 'completed', 'دفع طلب رقم ' || v_order_number)
    RETURNING id INTO v_transaction_id;
  END IF;

  RETURN v_order_id;
END;
$function$;

CREATE OR REPLACE VIEW public.orders_admin AS
SELECT
  id,
  user_id,
  order_number,
  status,
  total_amount,
  currency,
  shipping_address,
  phone_number,
  governorate,
  shipping_notes,
  created_at,
  updated_at,
  shipped_at,
  delivered_at,
  serial_number_image_url,
  arrived_warehouse_at,
  arrived_iraq_at,
  user_confirmed_delivery,
  user_confirmed_at,
  auto_confirmed,
  admin_images,
  admin_files,
  estimated_delivery_date,
  actual_weight,
  package_dimensions,
  customs_declaration_number,
  internal_notes,
  priority,
  payment_status,
  payment_method,
  subtotal,
  tax_amount,
  tax_percentage,
  discount_amount,
  paid_amount,
  remaining_amount,
  shipping_route_type,
  shipping_duration_days,
  shipping_route_waypoints,
  admin_product_cost,
  admin_shipping_cost,
  admin_other_costs,
  profit_amount,
  financial_notes,
  admin_paid_amount,
  customer_paid_amount,
  confirmed_at,
  processing_at,
  purchased_at,
  on_the_way_at,
  cancelled_at,
  order_type,
  stock_deducted,
  delivery_method,
  card_discount_amount,
  card_discount_level_name,
  referral_coupon_id,
  referral_owner_earnings_iqd,
  cod_fee
FROM public._admin_orders_full();