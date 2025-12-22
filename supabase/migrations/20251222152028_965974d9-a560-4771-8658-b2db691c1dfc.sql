-- Fix duplicate notifications by improving the deduplication function
-- and adding a check to prevent Telegram duplicates

-- Update create_notification_if_not_exists to be more strict (5 minutes instead of 1)
CREATE OR REPLACE FUNCTION public.create_notification_if_not_exists(
  p_user_id uuid, 
  p_title text, 
  p_message text, 
  p_type text DEFAULT 'info'::text, 
  p_related_id uuid DEFAULT NULL::uuid, 
  p_is_general boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if similar notification exists in the last 5 minutes (increased from 1 minute)
  IF NOT EXISTS (
    SELECT 1 FROM notifications
    WHERE user_id = p_user_id
    AND title = p_title
    AND (p_related_id IS NULL OR related_id = p_related_id)
    AND created_at > NOW() - INTERVAL '5 minutes'
  ) THEN
    INSERT INTO notifications (user_id, title, message, type, related_id, is_general)
    VALUES (p_user_id, p_title, p_message, p_type, p_related_id, p_is_general);
  END IF;
END;
$function$;

-- Update notify_admins_wallet_transaction to use deduplication function
CREATE OR REPLACE FUNCTION public.notify_admins_wallet_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_profile RECORD;
  type_ar TEXT;
  admin_record RECORD;
BEGIN
  -- فقط للطلبات الجديدة (pending)
  IF NEW.status = 'pending' THEN
    -- Get user profile
    SELECT full_name, username INTO user_profile
    FROM public.profiles
    WHERE id = NEW.user_id;

    -- Get Arabic text for type
    type_ar := CASE NEW.type
      WHEN 'deposit' THEN 'تعبئة'
      WHEN 'withdrawal' THEN 'سحب'
      ELSE NEW.type
    END;

    -- Notify all admins using deduplication function
    FOR admin_record IN SELECT DISTINCT user_id FROM public.user_roles WHERE role = 'admin'
    LOOP
      PERFORM create_notification_if_not_exists(
        admin_record.user_id,
        'طلب ' || type_ar || ' جديد في المحفظة',
        'طلب ' || type_ar || ' جديد بمبلغ ' || NEW.amount || ' دينار عراقي من المستخدم ' || COALESCE(user_profile.full_name, user_profile.username),
        'info',
        NEW.id,
        FALSE
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;

-- Update notify_new_competition to use deduplication
CREATE OR REPLACE FUNCTION public.notify_new_competition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_record RECORD;
BEGIN
  -- Only trigger when a competition becomes active
  IF (TG_OP = 'INSERT' AND NEW.status = 'active') OR 
     (TG_OP = 'UPDATE' AND OLD.status != 'active' AND NEW.status = 'active') THEN
    
    -- Create notification for all users using deduplication
    FOR user_record IN SELECT id FROM public.profiles
    LOOP
      PERFORM create_notification_if_not_exists(
        user_record.id,
        '🎉 مسابقة جديدة!',
        'مسابقة جديدة متاحة الآن: ' || NEW.title_ar || ' - الجائزة: ' || NEW.prize_description_ar,
        'info',
        NEW.id,
        TRUE
      );
    END LOOP;

    -- Call edge function to send Telegram notifications (via pg_net if available)
    BEGIN
      PERFORM net.http_post(
        url := 'https://sajlfpygebpqwzpotrsg.supabase.co/functions/v1/notify-competition-telegram',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body := jsonb_build_object(
          'type', 'new_competition',
          'competition_id', NEW.id
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed to send new competition telegram notifications: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$function$;

-- Update send_user_telegram_notification to prevent duplicates
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
  recent_telegram_count INTEGER;
BEGIN
  -- Get user's telegram_chat_id
  SELECT telegram_chat_id INTO user_telegram_id
  FROM profiles
  WHERE id = NEW.user_id;
  
  -- If user has no telegram_chat_id, skip
  IF user_telegram_id IS NULL OR user_telegram_id = '' THEN
    RETURN NEW;
  END IF;
  
  -- Check if we already sent a similar telegram notification recently (within 5 minutes)
  -- This prevents duplicate telegram messages for the same notification content
  SELECT COUNT(*) INTO recent_telegram_count
  FROM notifications
  WHERE user_id = NEW.user_id
  AND title = NEW.title
  AND (NEW.related_id IS NULL OR related_id = NEW.related_id)
  AND created_at > NOW() - INTERVAL '5 minutes'
  AND id != NEW.id;
  
  IF recent_telegram_count > 0 THEN
    -- Already sent a similar notification recently, skip telegram
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