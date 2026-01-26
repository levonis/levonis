-- Fix the notify_new_listing_message function to work without user_listings table
CREATE OR REPLACE FUNCTION notify_new_listing_message()
RETURNS TRIGGER AS $$
DECLARE
  conv RECORD;
  recipient_id UUID;
  conv_code TEXT;
BEGIN
  -- Get conversation details without user_listings
  SELECT lc.buyer_id, lc.seller_id, lc.conversation_code
  INTO conv
  FROM listing_conversations lc
  WHERE lc.id = NEW.conversation_id;
  
  IF conv IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Determine recipient
  IF NEW.sender_id = conv.buyer_id THEN
    recipient_id := conv.seller_id;
  ELSE
    recipient_id := conv.buyer_id;
  END IF;
  
  conv_code := COALESCE(conv.conversation_code, 'محادثة');
  
  -- Insert notification
  INSERT INTO notifications (user_id, title, message, type, related_id)
  VALUES (
    recipient_id,
    'رسالة جديدة',
    'لديك رسالة جديدة في محادثة المجتمع #' || conv_code,
    'info',
    NEW.conversation_id
  );
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Don't fail the insert if notification fails
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;