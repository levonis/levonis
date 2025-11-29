-- Create function to notify admins on new wallet transaction
CREATE OR REPLACE FUNCTION public.notify_admins_wallet_transaction()
RETURNS TRIGGER AS $$
DECLARE
  user_profile RECORD;
  type_ar TEXT;
BEGIN
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

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for new wallet transactions
DROP TRIGGER IF EXISTS on_new_wallet_transaction ON public.wallet_transactions;
CREATE TRIGGER on_new_wallet_transaction
  AFTER INSERT ON public.wallet_transactions
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION public.notify_admins_wallet_transaction();