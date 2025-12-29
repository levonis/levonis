-- Create storage bucket for listing images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'listing-images', 
  'listing-images', 
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
) ON CONFLICT (id) DO NOTHING;

-- Storage policies for listing images
CREATE POLICY "Anyone can view listing images"
ON storage.objects FOR SELECT
USING (bucket_id = 'listing-images');

CREATE POLICY "Authenticated users can upload listing images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'listing-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own listing images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'listing-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own listing images"
ON storage.objects FOR DELETE
USING (bucket_id = 'listing-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Function to notify seller on listing status change
CREATE OR REPLACE FUNCTION notify_seller_listing_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Notify on approval
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    INSERT INTO notifications (user_id, title, message, type, related_id)
    VALUES (
      NEW.seller_id,
      'تمت الموافقة على منتجك',
      'تمت الموافقة على منتج "' || NEW.title_ar || '" وهو الآن معروض في السوق المستعمل',
      'success',
      NEW.id
    );
  END IF;
  
  -- Notify on rejection
  IF NEW.status = 'rejected' AND (OLD.status IS NULL OR OLD.status != 'rejected') THEN
    INSERT INTO notifications (user_id, title, message, type, related_id)
    VALUES (
      NEW.seller_id,
      'تم رفض منتجك',
      'تم رفض منتج "' || NEW.title_ar || '". السبب: ' || COALESCE(NEW.admin_notes, 'لم يتم تحديد سبب'),
      'error',
      NEW.id
    );
  END IF;
  
  -- Notify on sale (when status changes to sold)
  IF NEW.status = 'sold' AND (OLD.status IS NULL OR OLD.status != 'sold') THEN
    INSERT INTO notifications (user_id, title, message, type, related_id)
    VALUES (
      NEW.seller_id,
      'تم بيع منتجك',
      'تهانينا! تم بيع منتج "' || NEW.title_ar || '" بنجاح',
      'success',
      NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for listing status changes
DROP TRIGGER IF EXISTS on_listing_status_change ON user_listings;
CREATE TRIGGER on_listing_status_change
  AFTER INSERT OR UPDATE OF status ON user_listings
  FOR EACH ROW
  EXECUTE FUNCTION notify_seller_listing_status();

-- Function to notify on new message
CREATE OR REPLACE FUNCTION notify_new_listing_message()
RETURNS TRIGGER AS $$
DECLARE
  conv RECORD;
  recipient_id UUID;
  listing_title TEXT;
BEGIN
  -- Get conversation details
  SELECT lc.*, ul.title_ar 
  INTO conv
  FROM listing_conversations lc
  JOIN user_listings ul ON ul.id = lc.listing_id
  WHERE lc.id = NEW.conversation_id;
  
  -- Determine recipient (the other party in the conversation)
  IF NEW.sender_id = conv.buyer_id THEN
    recipient_id := conv.seller_id;
  ELSE
    recipient_id := conv.buyer_id;
  END IF;
  
  -- Create notification for the recipient
  INSERT INTO notifications (user_id, title, message, type, related_id)
  VALUES (
    recipient_id,
    'رسالة جديدة',
    'لديك رسالة جديدة بخصوص منتج "' || conv.title_ar || '"',
    'info',
    NEW.conversation_id
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new messages
DROP TRIGGER IF EXISTS on_new_listing_message ON listing_messages;
CREATE TRIGGER on_new_listing_message
  AFTER INSERT ON listing_messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_listing_message();

-- Function to notify on new transaction
CREATE OR REPLACE FUNCTION notify_listing_transaction()
RETURNS TRIGGER AS $$
DECLARE
  listing_title TEXT;
BEGIN
  -- Get listing title
  SELECT title_ar INTO listing_title
  FROM user_listings
  WHERE id = NEW.listing_id;
  
  -- Notify seller about new purchase
  INSERT INTO notifications (user_id, title, message, type, related_id)
  VALUES (
    NEW.seller_id,
    'طلب شراء جديد',
    'لديك طلب شراء جديد لمنتج "' || listing_title || '"',
    'info',
    NEW.id
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new transactions
DROP TRIGGER IF EXISTS on_new_listing_transaction ON listing_transactions;
CREATE TRIGGER on_new_listing_transaction
  AFTER INSERT ON listing_transactions
  FOR EACH ROW
  EXECUTE FUNCTION notify_listing_transaction();