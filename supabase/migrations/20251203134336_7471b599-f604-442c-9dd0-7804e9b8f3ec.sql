-- Create table to track admin's active chat context for Telegram replies
CREATE TABLE IF NOT EXISTS public.admin_telegram_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_telegram_chat_id TEXT NOT NULL UNIQUE,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_telegram_context ENABLE ROW LEVEL SECURITY;

-- Allow edge functions to manage this table (service role)
CREATE POLICY "Service role can manage admin_telegram_context"
ON public.admin_telegram_context
FOR ALL
USING (true)
WITH CHECK (true);

-- Update notify_new_message to include actual message content for users
CREATE OR REPLACE FUNCTION public.notify_new_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  conversation_record RECORD;
  sender_profile RECORD;
  recipient_id UUID;
BEGIN
  -- Get conversation details
  SELECT * INTO conversation_record
  FROM public.conversations
  WHERE id = NEW.conversation_id;
  
  -- Get sender profile
  SELECT * INTO sender_profile
  FROM public.profiles
  WHERE id = NEW.sender_id;
  
  -- Determine recipient
  IF has_role(NEW.sender_id, 'admin'::app_role) THEN
    -- If admin sent message, notify the user with message content
    recipient_id := conversation_record.user_id;
    
    INSERT INTO public.notifications (user_id, title, message, type, related_id)
    VALUES (
      recipient_id,
      'رسالة جديدة من خدمة العملاء',
      CASE 
        WHEN NEW.image_url IS NOT NULL THEN 'صورة: ' || COALESCE(LEFT(NEW.content, 80), 'صورة مرفقة')
        ELSE LEFT(NEW.content, 100)
      END,
      'info',
      NEW.conversation_id
    );
  ELSE
    -- If user sent message, notify admins with message content
    INSERT INTO public.notifications (user_id, title, message, type, related_id)
    SELECT 
      ur.user_id,
      'رسالة جديدة من ' || COALESCE(sender_profile.full_name, sender_profile.username),
      CASE 
        WHEN NEW.image_url IS NOT NULL THEN 'صورة: ' || COALESCE(LEFT(NEW.content, 80), 'صورة مرفقة')
        ELSE LEFT(NEW.content, 100)
      END,
      'info',
      NEW.conversation_id
    FROM public.user_roles ur
    WHERE ur.role = 'admin';
  END IF;
  
  RETURN NEW;
END;
$function$;