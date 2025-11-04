-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  read BOOLEAN NOT NULL DEFAULT false,
  related_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view their own notifications"
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications"
ON public.notifications
FOR UPDATE
USING (auth.uid() = user_id);

-- Add custom_request_id to cart_items
ALTER TABLE public.cart_items 
ADD COLUMN IF NOT EXISTS custom_request_id UUID REFERENCES public.custom_product_requests(id) ON DELETE CASCADE;

-- Create function to notify user when custom request is updated
CREATE OR REPLACE FUNCTION notify_custom_request_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only notify if status changed or price was added
  IF (OLD.status IS DISTINCT FROM NEW.status) OR 
     (OLD.suggested_price IS NULL AND NEW.suggested_price IS NOT NULL) THEN
    
    INSERT INTO public.notifications (user_id, title, message, type, related_id)
    VALUES (
      NEW.user_id,
      'تحديث على طلبك المخصص',
      CASE 
        WHEN NEW.status = 'approved' AND NEW.suggested_price IS NOT NULL THEN
          'تم الموافقة على طلبك المخصص وتحديد السعر. يمكنك الآن إضافته للسلة!'
        WHEN NEW.status = 'approved' THEN
          'تم الموافقة على طلبك المخصص!'
        WHEN NEW.status = 'rejected' THEN
          'تم رفض طلبك المخصص. يرجى مراجعة ملاحظات الإدارة.'
        WHEN NEW.status = 'reviewed' THEN
          'تمت مراجعة طلبك المخصص من قبل الإدارة.'
        WHEN NEW.suggested_price IS NOT NULL THEN
          'تم تحديد سعر لطلبك المخصص!'
        ELSE
          'تم تحديث طلبك المخصص'
      END,
      CASE 
        WHEN NEW.status = 'approved' THEN 'success'
        WHEN NEW.status = 'rejected' THEN 'error'
        ELSE 'info'
      END,
      NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS custom_request_update_trigger ON public.custom_product_requests;
CREATE TRIGGER custom_request_update_trigger
AFTER UPDATE ON public.custom_product_requests
FOR EACH ROW
EXECUTE FUNCTION notify_custom_request_update();