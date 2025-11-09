-- تحديث trigger معالجة معاملات المحفظة لإضافة إشعار عند الرفض
CREATE OR REPLACE FUNCTION public.process_wallet_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- معالجة عند الموافقة
  IF OLD.status != 'approved' AND NEW.status = 'approved' THEN
    IF NEW.type = 'deposit' THEN
      -- إضافة للمحفظة
      INSERT INTO user_wallets (user_id, balance, currency)
      VALUES (NEW.user_id, NEW.amount, 'دينار عراقي')
      ON CONFLICT (user_id) DO UPDATE
      SET 
        balance = user_wallets.balance + NEW.amount,
        updated_at = now();
        
      -- إرسال إشعار
      INSERT INTO notifications (user_id, title, message, type)
      VALUES (
        NEW.user_id,
        'تم تعبئة المحفظة',
        'تم إضافة ' || NEW.amount || ' دينار عراقي إلى محفظتك بنجاح',
        'success'
      );
      
    ELSIF NEW.type = 'withdrawal' THEN
      -- خصم من المحفظة
      UPDATE user_wallets
      SET 
        balance = balance - NEW.amount,
        updated_at = now()
      WHERE user_id = NEW.user_id;
      
      -- إرسال إشعار
      INSERT INTO notifications (user_id, title, message, type)
      VALUES (
        NEW.user_id,
        'تم سحب الرصيد',
        'تم سحب ' || NEW.amount || ' دينار عراقي من محفظتك بنجاح',
        'success'
      );
    END IF;
  END IF;
  
  -- معالجة عند الرفض
  IF OLD.status != 'rejected' AND NEW.status = 'rejected' THEN
    INSERT INTO notifications (user_id, title, message, type)
    VALUES (
      NEW.user_id,
      'تم رفض الطلب',
      CASE 
        WHEN NEW.type = 'deposit' THEN
          'تم رفض طلب تعبئة المحفظة بمبلغ ' || NEW.amount || ' دينار عراقي' || 
          CASE 
            WHEN NEW.admin_notes IS NOT NULL THEN '. السبب: ' || NEW.admin_notes 
            ELSE '' 
          END
        WHEN NEW.type = 'withdrawal' THEN
          'تم رفض طلب سحب ' || NEW.amount || ' دينار عراقي من المحفظة' ||
          CASE 
            WHEN NEW.admin_notes IS NOT NULL THEN '. السبب: ' || NEW.admin_notes 
            ELSE '' 
          END
        ELSE
          'تم رفض المعاملة'
      END,
      'error'
    );
  END IF;
  
  RETURN NEW;
END;
$$;