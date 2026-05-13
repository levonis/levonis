CREATE OR REPLACE FUNCTION public.notify_admin_wallet_topup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_internal_secret text;
  v_profile RECORD;
  v_msg text;
  v_method text;
  v_proof text;
BEGIN
  -- Only fire on new pending deposit topups
  IF NEW.type IS DISTINCT FROM 'deposit' THEN RETURN NEW; END IF;
  IF NEW.status IS DISTINCT FROM 'pending' THEN RETURN NEW; END IF;

  SELECT full_name, username, phone_number
  INTO v_profile
  FROM public.profiles
  WHERE id = NEW.user_id;

  v_method := COALESCE(NEW.payment_method, 'غير محدد');
  v_proof := COALESCE(NEW.payment_proof_url, '—');

  v_msg :=
    '💰 <b>طلب تعبئة محفظة جديد</b>' || E'\n\n' ||
    '👤 المستخدم: ' || COALESCE(v_profile.full_name, v_profile.username, 'غير معروف') || E'\n' ||
    '📱 الهاتف: ' || COALESCE(v_profile.phone_number, '—') || E'\n' ||
    '💵 المبلغ: ' || to_char(NEW.amount, 'FM999,999,999') || ' د.ع' || E'\n' ||
    '💳 طريقة الدفع: ' || v_method || E'\n' ||
    '🧾 إثبات الدفع: ' || v_proof || E'\n\n' ||
    '🆔 المعاملة: ' || NEW.id::text;

  BEGIN
    v_internal_secret := public.get_internal_http_secret('send-telegram-notification');
    IF v_internal_secret IS NOT NULL AND v_internal_secret <> '' THEN
      PERFORM net.http_post(
        url := 'https://sajlfpygebpqwzpotrsg.supabase.co/functions/v1/send-telegram-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-lovable-internal-secret', v_internal_secret
        ),
        body := jsonb_build_object(
          'message', v_msg,
          'parse_mode', 'HTML',
          'channel_key', 'wallet_updates'
        )
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Failed to send wallet topup telegram notification: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_wallet_topup ON public.wallet_transactions;
CREATE TRIGGER trg_notify_admin_wallet_topup
AFTER INSERT ON public.wallet_transactions
FOR EACH ROW
EXECUTE FUNCTION public.notify_admin_wallet_topup();