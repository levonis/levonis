-- Create user_wallets table
CREATE TABLE IF NOT EXISTS public.user_wallets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  balance NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'دينار عراقي',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create wallet_transactions table
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'deposit', 'withdrawal', 'points_conversion', 'order_payment'
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'completed'
  admin_notes TEXT,
  payment_proof_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_wallets
CREATE POLICY "Users can view their own wallet"
  ON public.user_wallets
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all wallets"
  ON public.user_wallets
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert wallets"
  ON public.user_wallets
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update wallets"
  ON public.user_wallets
  FOR UPDATE
  USING (true);

-- RLS Policies for wallet_transactions
CREATE POLICY "Users can view their own transactions"
  ON public.wallet_transactions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all transactions"
  ON public.wallet_transactions
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can create their own transactions"
  ON public.wallet_transactions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update transactions"
  ON public.wallet_transactions
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger to update updated_at
CREATE TRIGGER update_user_wallets_updated_at
  BEFORE UPDATE ON public.user_wallets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_wallet_transactions_updated_at
  BEFORE UPDATE ON public.wallet_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to handle wallet transaction approval
CREATE OR REPLACE FUNCTION public.process_wallet_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only process when status changes to 'approved'
  IF OLD.status != 'approved' AND NEW.status = 'approved' THEN
    IF NEW.type = 'deposit' THEN
      -- Add to wallet balance
      INSERT INTO user_wallets (user_id, balance, currency)
      VALUES (NEW.user_id, NEW.amount, 'دينار عراقي')
      ON CONFLICT (user_id) DO UPDATE
      SET 
        balance = user_wallets.balance + NEW.amount,
        updated_at = now();
        
      -- Send notification
      INSERT INTO notifications (user_id, title, message, type)
      VALUES (
        NEW.user_id,
        'تم تعبئة المحفظة',
        'تم إضافة ' || NEW.amount || ' دينار عراقي إلى محفظتك',
        'success'
      );
      
    ELSIF NEW.type = 'withdrawal' THEN
      -- Deduct from wallet balance
      UPDATE user_wallets
      SET 
        balance = balance - NEW.amount,
        updated_at = now()
      WHERE user_id = NEW.user_id;
      
      -- Send notification
      INSERT INTO notifications (user_id, title, message, type)
      VALUES (
        NEW.user_id,
        'تم سحب الرصيد',
        'تم سحب ' || NEW.amount || ' دينار عراقي من محفظتك',
        'success'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger for transaction approval
CREATE TRIGGER on_wallet_transaction_approved
  AFTER UPDATE ON public.wallet_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.process_wallet_transaction();

-- Function to convert points to wallet balance
CREATE OR REPLACE FUNCTION public.convert_points_to_wallet(points_amount NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id UUID;
  settings_data JSONB;
  conversion_rate NUMERIC;
  money_amount NUMERIC;
  user_available_points NUMERIC;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'غير مصرح');
  END IF;

  -- Get conversion settings
  SELECT setting_value INTO settings_data
  FROM default_settings
  WHERE setting_key = 'points_settings';

  conversion_rate := COALESCE((settings_data->>'conversion_rate')::NUMERIC, 100);
  
  -- Calculate money amount
  money_amount := points_amount / conversion_rate;
  
  -- Check if user has enough points
  SELECT available_points INTO user_available_points
  FROM user_points
  WHERE user_id = current_user_id;
  
  IF user_available_points IS NULL OR user_available_points < points_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'رصيد نقاط غير كافٍ');
  END IF;
  
  -- Deduct points
  UPDATE user_points
  SET 
    available_points = available_points - points_amount,
    redeemed_points = redeemed_points + points_amount,
    updated_at = now()
  WHERE user_id = current_user_id;
  
  -- Record points transaction
  INSERT INTO points_transactions (user_id, points, type, source, description)
  VALUES (
    current_user_id,
    -points_amount,
    'redeemed',
    'wallet_conversion',
    'تحويل النقاط إلى رصيد المحفظة'
  );
  
  -- Add to wallet
  INSERT INTO user_wallets (user_id, balance, currency)
  VALUES (current_user_id, money_amount, 'دينار عراقي')
  ON CONFLICT (user_id) DO UPDATE
  SET 
    balance = user_wallets.balance + money_amount,
    updated_at = now();
  
  -- Record wallet transaction
  INSERT INTO wallet_transactions (user_id, type, amount, status)
  VALUES (
    current_user_id,
    'points_conversion',
    money_amount,
    'completed'
  );
  
  -- Send notification
  INSERT INTO notifications (user_id, title, message, type)
  VALUES (
    current_user_id,
    'تحويل النقاط',
    'تم تحويل ' || points_amount || ' نقطة إلى ' || money_amount || ' دينار عراقي في محفظتك',
    'success'
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'points_converted', points_amount,
    'money_amount', money_amount
  );
END;
$$;