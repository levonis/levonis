CREATE OR REPLACE FUNCTION public.notify_admins_wallet_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_profile RECORD;
  type_ar TEXT;
  admin_record RECORD;
  user_label TEXT;
  msg TEXT;
BEGIN
  IF NEW.status = 'pending' THEN
    SELECT full_name, username INTO user_profile
    FROM public.profiles WHERE id = NEW.user_id;

    type_ar := CASE NEW.type
      WHEN 'deposit' THEN 'تعبئة'
      WHEN 'withdrawal' THEN 'سحب'
      ELSE NEW.type
    END;

    user_label := COALESCE(NULLIF(user_profile.full_name, ''), NULLIF(user_profile.username, ''), NEW.user_id::text);
    msg := 'طلب ' || type_ar || ' جديد بمبلغ ' || NEW.amount || ' دينار عراقي من المستخدم ' || user_label;

    BEGIN
      FOR admin_record IN SELECT DISTINCT user_id FROM public.user_roles WHERE role = 'admin'
      LOOP
        BEGIN
          PERFORM create_notification_if_not_exists(
            admin_record.user_id,
            'طلب ' || type_ar || ' جديد في المحفظة',
            msg,
            'info',
            NEW.id,
            FALSE
          );
        EXCEPTION WHEN OTHERS THEN
          -- Never break the wallet deduction because of a notification error
          RAISE WARNING 'notify_admins_wallet_transaction: failed for admin % : %', admin_record.user_id, SQLERRM;
        END;
      END LOOP;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'notify_admins_wallet_transaction: outer failure: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;