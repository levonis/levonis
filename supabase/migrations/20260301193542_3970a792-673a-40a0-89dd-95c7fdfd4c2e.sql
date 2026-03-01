
-- Create function to notify users when stock is restored
CREATE OR REPLACE FUNCTION public.notify_stock_restored()
RETURNS TRIGGER AS $$
DECLARE
  product_title TEXT;
  subscriber RECORD;
BEGIN
  -- Only trigger when direct_stock changes from 0 (or null) to > 0
  -- OR when has_in_stock changes from false to true
  IF (
    (OLD.direct_stock IS NOT NULL AND OLD.direct_stock <= 0 AND NEW.direct_stock > 0)
    OR (OLD.has_in_stock = false AND NEW.has_in_stock = true)
  ) THEN
    product_title := COALESCE(NEW.name_ar, NEW.name);
    
    -- Get all subscribers for this product who haven't been notified yet
    FOR subscriber IN 
      SELECT sn.id, sn.user_id 
      FROM public.stock_notifications sn 
      WHERE sn.product_id = NEW.id AND sn.notified_at IS NULL
    LOOP
      -- Create in-app notification
      INSERT INTO public.notifications (user_id, title, message, type, related_id, is_general)
      VALUES (
        subscriber.user_id,
        'المنتج متوفر الآن! 🎉',
        'المنتج "' || product_title || '" أصبح متوفراً للبيع المباشر الآن.',
        'success',
        NEW.id,
        false
      );
      
      -- Mark as notified
      UPDATE public.stock_notifications SET notified_at = now() WHERE id = subscriber.id;
    END LOOP;
    
    -- Call edge function for telegram notifications (async via pg_net if available)
    -- We'll handle telegram via edge function called from the app
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url', true) || '/functions/v1/notify-restock',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object('product_id', NEW.id, 'product_title', product_title)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger
DROP TRIGGER IF EXISTS trg_notify_stock_restored ON public.products;
CREATE TRIGGER trg_notify_stock_restored
  AFTER UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_stock_restored();
