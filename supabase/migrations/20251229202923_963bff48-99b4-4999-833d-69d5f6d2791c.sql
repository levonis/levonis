-- Fix function search_path security warnings
CREATE OR REPLACE FUNCTION notify_seller_listing_status()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION notify_new_listing_message()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conv RECORD;
  recipient_id UUID;
BEGIN
  SELECT lc.*, ul.title_ar 
  INTO conv
  FROM listing_conversations lc
  JOIN user_listings ul ON ul.id = lc.listing_id
  WHERE lc.id = NEW.conversation_id;
  
  IF NEW.sender_id = conv.buyer_id THEN
    recipient_id := conv.seller_id;
  ELSE
    recipient_id := conv.buyer_id;
  END IF;
  
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
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION notify_listing_transaction()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  listing_title TEXT;
BEGIN
  SELECT title_ar INTO listing_title
  FROM user_listings
  WHERE id = NEW.listing_id;
  
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
$$ LANGUAGE plpgsql;