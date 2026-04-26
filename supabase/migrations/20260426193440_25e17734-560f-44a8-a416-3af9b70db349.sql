-- Admin-only function to gift a loyalty card to any user, bypassing is_purchasable
CREATE OR REPLACE FUNCTION public.admin_gift_loyalty_card(
  p_recipient_id uuid,
  p_level_id uuid,
  p_message text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_level RECORD;
  v_new_card_id uuid;
  v_gift_id uuid;
  v_expires_at timestamptz;
BEGIN
  -- Only admins
  IF v_admin_id IS NULL OR NOT public.has_role(v_admin_id, 'admin'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  IF p_recipient_id IS NULL OR p_level_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'بيانات ناقصة');
  END IF;

  SELECT * INTO v_level FROM loyalty_levels WHERE id = p_level_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'البطاقة غير موجودة');
  END IF;

  -- Deactivate recipient's old active card
  UPDATE user_cards SET is_active = false WHERE user_id = p_recipient_id AND is_active = true;

  -- Compute expiry (fallback 365 days if duration_days is null)
  v_expires_at := now() + (COALESCE(v_level.duration_days, 365) || ' days')::interval;

  INSERT INTO user_cards (user_id, level_id, is_active, expires_at, payment_method, wallet_amount_paid)
  VALUES (p_recipient_id, p_level_id, true, v_expires_at, 'admin_gift', 0)
  RETURNING id INTO v_new_card_id;

  INSERT INTO card_gifts (gifter_id, recipient_id, level_id, payment_method, amount_paid, card_id, message)
  VALUES (v_admin_id, p_recipient_id, p_level_id, 'admin_gift', 0, v_new_card_id, p_message)
  RETURNING id INTO v_gift_id;

  RETURN jsonb_build_object('success', true, 'card_id', v_new_card_id, 'gift_id', v_gift_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_gift_loyalty_card(uuid, uuid, text) TO authenticated;