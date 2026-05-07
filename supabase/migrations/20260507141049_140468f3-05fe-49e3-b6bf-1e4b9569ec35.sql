CREATE OR REPLACE FUNCTION public.send_user_telegram_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_telegram_id text;
  type_emoji text;
  telegram_message text;
  is_chat_notification boolean;
  conversation_record record;
  request_body jsonb;
  recent_telegram_count integer;
  v_internal_secret text;
BEGIN
  IF NEW.is_general = TRUE THEN
    RETURN NEW;
  END IF;

  SELECT telegram_chat_id INTO user_telegram_id
  FROM public.profiles
  WHERE id = NEW.user_id;

  IF user_telegram_id IS NULL OR user_telegram_id = '' THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO recent_telegram_count
  FROM public.notifications
  WHERE user_id = NEW.user_id
    AND title = NEW.title
    AND (NEW.related_id IS NULL OR related_id = NEW.related_id)
    AND created_at > now() - interval '5 minutes'
    AND id <> NEW.id;

  IF recent_telegram_count > 0 THEN
    RETURN NEW;
  END IF;

  type_emoji := CASE NEW.type
    WHEN 'success' THEN '✅'
    WHEN 'error' THEN '❌'
    WHEN 'warning' THEN '⚠️'
    ELSE 'ℹ️'
  END;

  telegram_message := type_emoji || ' ' || NEW.title || E'\n\n' || NEW.message || E'\n\n🛍️ LEVONIS';
  is_chat_notification := NEW.title LIKE '%رسالة جديدة%' AND NEW.related_id IS NOT NULL;

  request_body := jsonb_build_object(
    'message', telegram_message,
    'chat_id', user_telegram_id,
    'parse_mode', 'HTML'
  );

  IF is_chat_notification THEN
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.user_id AND role = 'admin') THEN
      SELECT c.id, c.user_id INTO conversation_record
      FROM public.conversations c
      WHERE c.id = NEW.related_id;

      IF conversation_record IS NOT NULL THEN
        request_body := request_body || jsonb_build_object(
          'conversation_id', conversation_record.id,
          'customer_user_id', conversation_record.user_id
        );
        telegram_message := telegram_message || E'\n\n💬 للرد، أرسل رسالتك هنا مباشرة';
        request_body := jsonb_set(request_body, '{message}', to_jsonb(telegram_message));
      END IF;
    END IF;
  END IF;

  BEGIN
    v_internal_secret := public.get_internal_http_secret('send-telegram-notification');
    IF v_internal_secret IS NOT NULL AND v_internal_secret <> '' THEN
      PERFORM net.http_post(
        url := 'https://sajlfpygebpqwzpotrsg.supabase.co/functions/v1/send-telegram-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-lovable-internal-secret', v_internal_secret
        ),
        body := request_body
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Failed to send telegram notification: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;