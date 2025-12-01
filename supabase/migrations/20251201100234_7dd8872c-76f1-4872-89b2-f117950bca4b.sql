-- Create a function to send telegram notifications to users
-- This will be called after each notification is created
CREATE OR REPLACE FUNCTION public.send_user_telegram_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_telegram_id TEXT;
  edge_function_url TEXT;
  type_emoji TEXT;
  telegram_message TEXT;
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
  
  -- Use pg_net to call the edge function (if available)
  -- Note: This requires the pg_net extension to be enabled
  BEGIN
    PERFORM net.http_post(
      url := 'https://sajlfpygebpqwzpotrsg.supabase.co/functions/v1/send-telegram-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object(
        'message', telegram_message,
        'chat_id', user_telegram_id,
        'parse_mode', 'HTML'
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the trigger
    RAISE NOTICE 'Failed to send telegram notification: %', SQLERRM;
  END;
  
  RETURN NEW;
END;
$$;

-- Create trigger for sending telegram notifications
DROP TRIGGER IF EXISTS on_notification_created_send_telegram ON notifications;
CREATE TRIGGER on_notification_created_send_telegram
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION send_user_telegram_notification();