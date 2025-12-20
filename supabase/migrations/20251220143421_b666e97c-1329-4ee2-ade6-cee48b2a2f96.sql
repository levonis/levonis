-- Create table to track coupon validation attempts
CREATE TABLE IF NOT EXISTS public.coupon_validation_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  ip_identifier TEXT,
  attempted_code TEXT NOT NULL,
  success BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.coupon_validation_attempts ENABLE ROW LEVEL SECURITY;

-- Only system can manage attempts (via SECURITY DEFINER functions)
CREATE POLICY "Block all direct access to validation attempts"
ON public.coupon_validation_attempts
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

-- Create index for faster lookups
CREATE INDEX idx_coupon_attempts_user_time ON public.coupon_validation_attempts(user_id, created_at);
CREATE INDEX idx_coupon_attempts_ip_time ON public.coupon_validation_attempts(ip_identifier, created_at);

-- Create rate-limited validate_coupon function
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
  max_attempts INTEGER := 5; -- Max 5 attempts per minute
  lockout_minutes INTEGER := 1;
BEGIN
  current_user_id := auth.uid();
  
  -- Check rate limit for authenticated users
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
  
  -- Log the attempt
  INSERT INTO public.coupon_validation_attempts (user_id, attempted_code, success)
  VALUES (current_user_id, LEFT(coupon_code, 50), false);
  
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
  IF current_user_id IS NOT NULL THEN
    SELECT COUNT(*) INTO user_usage_count
    FROM public.coupon_usage
    WHERE coupon_id = coupon_record.id AND user_id = current_user_id;
    
    IF user_usage_count > 0 THEN
      RETURN jsonb_build_object('valid', false, 'error', 'لقد استخدمت هذا الكوبون من قبل');
    END IF;
  END IF;
  
  -- Update the attempt as successful
  UPDATE public.coupon_validation_attempts
  SET success = true
  WHERE user_id = current_user_id
  AND attempted_code = LEFT(coupon_code, 50)
  AND created_at > NOW() - INTERVAL '1 second';
  
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

-- Create cleanup function for old attempts (run periodically)
CREATE OR REPLACE FUNCTION public.cleanup_old_coupon_attempts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.coupon_validation_attempts
  WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$;