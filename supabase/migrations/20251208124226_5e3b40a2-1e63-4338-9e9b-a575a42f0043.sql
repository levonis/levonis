-- Drop the overly permissive SELECT policy that exposes all coupon codes
DROP POLICY IF EXISTS "Anyone can view active coupons" ON public.coupons;

-- Create a secure function to validate coupon codes without exposing all coupons
CREATE OR REPLACE FUNCTION public.validate_coupon(coupon_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  coupon_record RECORD;
  user_usage_count INTEGER;
BEGIN
  -- Find the coupon by code
  SELECT * INTO coupon_record
  FROM public.coupons
  WHERE code = coupon_code
    AND active = true
    AND (expires_at IS NULL OR expires_at > now());
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'كوبون غير صالح أو منتهي الصلاحية');
  END IF;
  
  -- Check max uses
  IF coupon_record.max_uses IS NOT NULL AND coupon_record.current_uses >= coupon_record.max_uses THEN
    RETURN jsonb_build_object('valid', false, 'error', 'تم استخدام هذا الكوبون الحد الأقصى من المرات');
  END IF;
  
  -- Check if user already used this coupon
  IF auth.uid() IS NOT NULL THEN
    SELECT COUNT(*) INTO user_usage_count
    FROM public.coupon_usage
    WHERE coupon_id = coupon_record.id AND user_id = auth.uid();
    
    IF user_usage_count > 0 THEN
      RETURN jsonb_build_object('valid', false, 'error', 'لقد استخدمت هذا الكوبون من قبل');
    END IF;
  END IF;
  
  -- Return valid coupon details
  RETURN jsonb_build_object(
    'valid', true,
    'id', coupon_record.id,
    'code', coupon_record.code,
    'discount_type', coupon_record.discount_type,
    'discount_value', coupon_record.discount_value,
    'min_purchase_amount', coupon_record.min_purchase_amount
  );
END;
$$;