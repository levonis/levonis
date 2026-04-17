-- Add customization fields to referral_coupons
ALTER TABLE public.referral_coupons
  ADD COLUMN IF NOT EXISTS custom_message text,
  ADD COLUMN IF NOT EXISTS banner_style text NOT NULL DEFAULT 'amber';

-- Update apply_referral_coupon RPC to return customization
CREATE OR REPLACE FUNCTION public.apply_referral_coupon(p_code text, p_buyer_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_coupon record;
  v_owner_username text;
BEGIN
  SELECT * INTO v_coupon
  FROM public.referral_coupons
  WHERE lower(code) = lower(p_code)
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'invalid_or_expired');
  END IF;

  IF v_coupon.owner_user_id = p_buyer_user_id THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'self_use_not_allowed');
  END IF;

  SELECT username INTO v_owner_username
  FROM public.profiles
  WHERE id = v_coupon.owner_user_id;

  RETURN jsonb_build_object(
    'valid', true,
    'coupon_id', v_coupon.id,
    'owner_user_id', v_coupon.owner_user_id,
    'owner_username', COALESCE(v_owner_username, 'levo_vip'),
    'free_delivery', true,
    'custom_message', v_coupon.custom_message,
    'banner_style', v_coupon.banner_style
  );
END;
$function$;