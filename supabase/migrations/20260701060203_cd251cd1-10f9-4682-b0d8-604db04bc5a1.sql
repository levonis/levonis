-- Extend discount_type to include free_shipping
ALTER TABLE public.coupons DROP CONSTRAINT IF EXISTS coupons_discount_type_check;
ALTER TABLE public.coupons
  ADD CONSTRAINT coupons_discount_type_check
  CHECK (discount_type IN ('percentage','fixed','free_shipping'));

-- Allow discount_value = 0 for free_shipping (since discount is not monetary)
ALTER TABLE public.coupons DROP CONSTRAINT IF EXISTS coupons_discount_value_check;
ALTER TABLE public.coupons
  ADD CONSTRAINT coupons_discount_value_check
  CHECK (
    (discount_type = 'free_shipping' AND discount_value >= 0)
    OR (discount_type IN ('percentage','fixed') AND discount_value > 0)
  );

-- Delivery method targeting (NULL = any)
ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS applicable_delivery_method text;

-- Update validator RPC to include the new fields
CREATE OR REPLACE FUNCTION public.validate_coupon_with_rate_limit(coupon_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  coupon_record RECORD;
  user_usage_count INTEGER;
  recent_attempts INTEGER;
  current_user_id UUID;
  max_attempts INTEGER := 5;
  lockout_minutes INTEGER := 1;
BEGIN
  current_user_id := auth.uid();

  IF current_user_id IS NOT NULL THEN
    SELECT COUNT(*) INTO recent_attempts
    FROM public.coupon_validation_attempts
    WHERE user_id = current_user_id
    AND created_at > NOW() - INTERVAL '1 minute';

    IF recent_attempts >= max_attempts THEN
      RETURN jsonb_build_object(
        'valid', false,
        'error', 'تم تجاوز عدد المحاولات المسموح بها. يرجى الانتظار دقيقة واحدة.',
        'rate_limited', true
      );
    END IF;
  END IF;

  INSERT INTO public.coupon_validation_attempts (user_id, attempted_code, success)
  VALUES (current_user_id, LEFT(coupon_code, 50), false);

  SELECT * INTO coupon_record
  FROM public.coupons
  WHERE code = coupon_code
    AND active = true
    AND (expires_at IS NULL OR expires_at > now());

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'كوبون غير صالح أو منتهي الصلاحية');
  END IF;

  IF coupon_record.max_uses IS NOT NULL AND coupon_record.current_uses >= coupon_record.max_uses THEN
    RETURN jsonb_build_object('valid', false, 'error', 'تم استخدام هذا الكوبون الحد الأقصى من المرات');
  END IF;

  IF current_user_id IS NOT NULL THEN
    SELECT COUNT(*) INTO user_usage_count
    FROM public.coupon_usage
    WHERE coupon_id = coupon_record.id AND user_id = current_user_id;

    IF user_usage_count > 0 THEN
      RETURN jsonb_build_object('valid', false, 'error', 'لقد استخدمت هذا الكوبون من قبل');
    END IF;
  END IF;

  UPDATE public.coupon_validation_attempts
  SET success = true
  WHERE user_id = current_user_id
  AND attempted_code = LEFT(coupon_code, 50)
  AND created_at > NOW() - INTERVAL '1 second';

  RETURN jsonb_build_object(
    'valid', true,
    'id', coupon_record.id,
    'code', coupon_record.code,
    'discount_type', coupon_record.discount_type,
    'discount_value', coupon_record.discount_value,
    'min_purchase_amount', coupon_record.min_purchase_amount,
    'applicable_delivery_method', coupon_record.applicable_delivery_method
  );
END;
$$;