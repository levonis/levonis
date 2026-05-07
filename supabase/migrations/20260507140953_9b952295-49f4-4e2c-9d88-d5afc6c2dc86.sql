-- Ensure there is only one admin-new-order trigger to avoid duplicate Telegram sends
DROP TRIGGER IF EXISTS trigger_notify_admins_new_order ON public.orders;

-- Private internal secret for trusted database -> edge-function calls.
-- No client policies are added; this table is only read by SECURITY DEFINER DB functions and service-role edge code.
CREATE TABLE IF NOT EXISTS public.internal_http_secrets (
  purpose text PRIMARY KEY,
  secret text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.internal_http_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.internal_http_secrets FROM anon, authenticated;

INSERT INTO public.internal_http_secrets (purpose, secret)
VALUES ('send-telegram-notification', encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (purpose) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_internal_http_secret(p_purpose text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT secret FROM public.internal_http_secrets WHERE purpose = p_purpose
$$;

REVOKE ALL ON FUNCTION public.get_internal_http_secret(text) FROM PUBLIC;

-- The one-argument overload was still being selected by client RPC calls.
-- Replace it with a wrapper so every caller uses the fixed two-argument implementation.
CREATE OR REPLACE FUNCTION public.finalize_and_reveal_rf_for_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.finalize_and_reveal_rf_for_order(p_order_id, NULL::text);
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalize_and_reveal_rf_for_order(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.reveal_random_filament_orders(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_owner uuid;
BEGIN
  SELECT user_id INTO v_owner FROM public.orders WHERE id = p_order_id;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;
  IF v_owner <> v_user AND NOT public.has_role(v_user, 'admin') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  PERFORM public.finalize_and_reveal_rf_for_order(p_order_id, NULL::text);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reveal_random_filament_orders(uuid) TO authenticated;

-- Backend fallback: when an RF order_item is inserted after the order already exists as confirmed/paid,
-- finalize immediately even if the frontend RPC is skipped or hits the old overload.
CREATE OR REPLACE FUNCTION public.auto_finalize_rf_after_order_item_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_status text;
  v_payment_status text;
BEGIN
  IF NEW.rf_offer_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT status, payment_status
    INTO v_order_status, v_payment_status
  FROM public.orders
  WHERE id = NEW.order_id;

  IF v_payment_status = 'paid' OR v_order_status IN ('confirmed', 'processing', 'purchased', 'arrived_warehouse', 'shipped', 'arrived_iraq', 'on_the_way', 'delivered') THEN
    PERFORM public.finalize_and_reveal_rf_for_order(NEW.order_id, NULL::text);
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'auto_finalize_rf_after_order_item_insert failed for order % item %: %', NEW.order_id, NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_finalize_rf_after_order_item_insert ON public.order_items;
CREATE TRIGGER trg_auto_finalize_rf_after_order_item_insert
  AFTER INSERT ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_finalize_rf_after_order_item_insert();

-- Send in-app admin notification and one trusted Telegram notification to the default admin chat.
CREATE OR REPLACE FUNCTION public.notify_admins_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_record RECORD;
  notification_message text;
  telegram_message text;
  v_internal_secret text;
BEGIN
  notification_message := 'تم إنشاء طلب جديد رقم ' || NEW.order_number || ' بقيمة ' || NEW.total_amount || ' ' || COALESCE(NEW.currency, 'د.ع');

  FOR admin_record IN SELECT DISTINCT user_id FROM public.user_roles WHERE role = 'admin'
  LOOP
    PERFORM public.create_notification_if_not_exists(
      admin_record.user_id,
      'طلب جديد',
      notification_message,
      'info',
      NEW.id,
      FALSE
    );
  END LOOP;

  BEGIN
    v_internal_secret := public.get_internal_http_secret('send-telegram-notification');
    telegram_message := '🛒 <b>طلب جديد</b>' || E'\n\n' ||
      '📋 رقم الطلب: ' || NEW.order_number || E'\n' ||
      '💰 المبلغ: ' || COALESCE(NEW.total_amount, 0)::text || ' ' || COALESCE(NEW.currency, 'د.ع') || E'\n' ||
      '📍 المحافظة: ' || COALESCE(NEW.governorate, 'غير محدد') || E'\n' ||
      '📞 الهاتف: ' || COALESCE(NEW.phone_number, 'غير محدد');

    IF v_internal_secret IS NOT NULL AND v_internal_secret <> '' THEN
      PERFORM net.http_post(
        url := 'https://sajlfpygebpqwzpotrsg.supabase.co/functions/v1/send-telegram-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-lovable-internal-secret', v_internal_secret
        ),
        body := jsonb_build_object(
          'message', telegram_message,
          'parse_mode', 'HTML',
          'channel_key', 'orders'
        )
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_admins_new_order telegram failed for order %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- Backfill any RF order that should already be revealed but still has no reveal row.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT o.id
    FROM public.orders o
    JOIN public.order_items oi ON oi.order_id = o.id
    WHERE oi.rf_offer_id IS NOT NULL
      AND (o.payment_status = 'paid' OR o.status IN ('confirmed', 'processing', 'purchased', 'arrived_warehouse', 'shipped', 'arrived_iraq', 'on_the_way', 'delivered') OR o.user_confirmed_delivery = true)
      AND NOT EXISTS (
        SELECT 1 FROM public.random_filament_orders rfo
        WHERE rfo.order_id = o.id AND rfo.offer_id = oi.rf_offer_id
      )
  LOOP
    BEGIN
      PERFORM public.finalize_and_reveal_rf_for_order(r.id, NULL::text);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'RF backfill skipped for order %: %', r.id, SQLERRM;
    END;
  END LOOP;
END $$;