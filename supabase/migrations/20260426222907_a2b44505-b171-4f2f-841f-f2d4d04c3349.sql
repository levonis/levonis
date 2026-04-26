-- Add shipping tracking columns
ALTER TABLE public.user_level_prize_claims
  ADD COLUMN IF NOT EXISTS shipping_address_id UUID,
  ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

-- RPC: User requests shipping for a manual prize (product/coupon)
CREATE OR REPLACE FUNCTION public.request_level_prize_shipping(
  p_claim_id UUID,
  p_address_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_claim RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  SELECT * INTO v_claim FROM public.user_level_prize_claims WHERE id = p_claim_id AND user_id = v_uid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'claim_not_found');
  END IF;

  IF v_claim.status NOT IN ('pending') THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_processed');
  END IF;

  UPDATE public.user_level_prize_claims
  SET status = 'requested',
      shipping_address_id = COALESCE(p_address_id, shipping_address_id),
      updated_at = now()
  WHERE id = p_claim_id;

  -- Notify admin
  INSERT INTO public.notifications (user_id, title, message, type, related_id)
  SELECT v_uid, 'طلب شحن جائزة مستوى', 'بانتظار مراجعة الإدارة لشحن جائزتك', 'info', p_claim_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Allow admins to update status (mark shipped/delivered)
CREATE OR REPLACE FUNCTION public.admin_update_level_prize_claim(
  p_claim_id UUID,
  p_new_status TEXT,
  p_notes TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF NOT public.has_role(v_uid, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  IF p_new_status NOT IN ('pending', 'requested', 'granted', 'shipped', 'delivered', 'cancelled') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_status');
  END IF;

  UPDATE public.user_level_prize_claims
  SET status = p_new_status,
      notes = COALESCE(p_notes, notes),
      shipped_at = CASE WHEN p_new_status = 'shipped' THEN now() ELSE shipped_at END,
      delivered_at = CASE WHEN p_new_status = 'delivered' THEN now() ELSE delivered_at END,
      granted_at = CASE WHEN p_new_status = 'granted' AND granted_at IS NULL THEN now() ELSE granted_at END,
      updated_at = now()
  WHERE id = p_claim_id;

  RETURN jsonb_build_object('success', true);
END;
$$;