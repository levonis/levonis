-- Update the send_user_telegram_notification trigger to include conversation context for admin replies
CREATE OR REPLACE FUNCTION public.send_user_telegram_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_telegram_id TEXT;
  type_emoji TEXT;
  telegram_message TEXT;
  is_chat_notification BOOLEAN;
  conversation_record RECORD;
  request_body JSONB;
BEGIN
  -- Get user's telegram_chat_id
  SELECT telegram_chat_id INTO user_telegram_id
  FROM profiles
  WHERE id = NEW.user_id;
  
  -- If user has no telegram_chat_id, skip
  IF user_telegram_id IS NULL OR user_telegram_id = '' THEN
    RETURN NEW;
  END IF;
  
  -- Determine emoji based on type
  type_emoji := CASE NEW.type
    WHEN 'success' THEN '✅'
    WHEN 'error' THEN '❌'
    WHEN 'warning' THEN '⚠️'
    ELSE 'ℹ️'
  END;
  
  -- Format message
  telegram_message := type_emoji || ' ' || NEW.title || E'\n\n' || NEW.message || E'\n\n🛍️ LEVONIS';
  
  -- Check if this is a chat notification (title contains رسالة جديدة)
  is_chat_notification := NEW.title LIKE '%رسالة جديدة%' AND NEW.related_id IS NOT NULL;
  
  -- Build request body
  request_body := jsonb_build_object(
    'message', telegram_message,
    'chat_id', user_telegram_id,
    'parse_mode', 'HTML'
  );
  
  -- If it's a chat notification and the recipient is an admin, add conversation context
  IF is_chat_notification THEN
    -- Check if this is for an admin (customer sending message)
    IF EXISTS (SELECT 1 FROM user_roles WHERE user_id = NEW.user_id AND role = 'admin') THEN
      -- Get conversation details
      SELECT c.id, c.user_id INTO conversation_record
      FROM conversations c
      WHERE c.id = NEW.related_id;
      
      IF conversation_record IS NOT NULL THEN
        -- Add context for admin to reply
        request_body := request_body || jsonb_build_object(
          'conversation_id', conversation_record.id,
          'customer_user_id', conversation_record.user_id
        );
        
        -- Add reply instruction to message
        telegram_message := telegram_message || E'\n\n💬 للرد، أرسل رسالتك هنا مباشرة';
        request_body := jsonb_set(request_body, '{message}', to_jsonb(telegram_message));
      END IF;
    END IF;
  END IF;
  
  -- Use pg_net to call the edge function
  BEGIN
    PERFORM net.http_post(
      url := 'https://sajlfpygebpqwzpotrsg.supabase.co/functions/v1/send-telegram-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := request_body
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Failed to send telegram notification: %', SQLERRM;
  END;
  
  RETURN NEW;
END;
$function$;