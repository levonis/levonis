-- Function to notify all users about new competition via notifications table
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
    
    -- Create notification for all users
    INSERT INTO public.notifications (user_id, title, message, type, related_id, is_general)
    SELECT 
      p.id,
      '🎉 مسابقة جديدة!',
      'مسابقة جديدة متاحة الآن: ' || NEW.title_ar || ' - الجائزة: ' || NEW.prize_description_ar,
      'info',
      NEW.id,
      true
    FROM public.profiles p;

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

-- Create trigger for new competition notifications
DROP TRIGGER IF EXISTS trigger_notify_new_competition ON public.competitions;
CREATE TRIGGER trigger_notify_new_competition
  AFTER INSERT OR UPDATE ON public.competitions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_competition();

-- Function to handle draw happening notification (called before auto-draw)
CREATE OR REPLACE FUNCTION public.notify_draw_happening(comp_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  comp_record RECORD;
BEGIN
  -- Get competition
  SELECT * INTO comp_record FROM competitions WHERE id = comp_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Call edge function to send Telegram notifications
  BEGIN
    PERFORM net.http_post(
      url := 'https://sajlfpygebpqwzpotrsg.supabase.co/functions/v1/notify-competition-telegram',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object(
        'type', 'draw_happening',
        'competition_id', comp_id
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Failed to send draw happening telegram notifications: %', SQLERRM;
  END;
END;
$function$;