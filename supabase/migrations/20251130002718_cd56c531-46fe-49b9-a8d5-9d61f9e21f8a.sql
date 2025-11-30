-- إضافة إعدادات المحفظة وطرق الدفع
INSERT INTO default_settings (setting_key, setting_value)
VALUES ('wallet_settings', '{
  "min_withdrawal_amount": 5000,
  "max_withdrawal_amount": 1000000,
  "payment_methods": [
    {
      "id": "mastercard_rafidain",
      "name": "ماستر كارد الرافدين",
      "name_en": "MasterCard Al-Rafidain",
      "account_number": "0000-0000-0000-0000",
      "is_active": true
    },
    {
      "id": "zaincash",
      "name": "زين كاش",
      "name_en": "Zain Cash",
      "account_number": "07800000000",
      "is_active": true
    }
  ]
}'::jsonb)
ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value;

-- إضافة عمود طريقة الدفع للمعاملات
ALTER TABLE wallet_transactions 
ADD COLUMN IF NOT EXISTS payment_method TEXT;

-- تحديث الـ trigger لإرسال إشعارات للإدارة عند إنشاء طلب جديد
CREATE OR REPLACE FUNCTION public.notify_admins_wallet_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_profile RECORD;
  type_ar TEXT;
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

    -- Notify all admins
    INSERT INTO public.notifications (user_id, title, message, type, related_id, is_general)
    SELECT 
      ur.user_id,
      'طلب ' || type_ar || ' جديد في المحفظة',
      'طلب ' || type_ar || ' جديد بمبلغ ' || NEW.amount || ' دينار عراقي من المستخدم ' || COALESCE(user_profile.full_name, user_profile.username),
      'info',
      NEW.id,
      false
    FROM public.user_roles ur
    WHERE ur.role = 'admin';
  END IF;

  RETURN NEW;
END;
$function$;

-- إنشاء trigger للإشعارات (إذا لم يكن موجود)
DROP TRIGGER IF EXISTS on_wallet_transaction_created ON wallet_transactions;
CREATE TRIGGER on_wallet_transaction_created
  AFTER INSERT ON wallet_transactions
  FOR EACH ROW
  EXECUTE FUNCTION notify_admins_wallet_transaction();