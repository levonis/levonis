-- إنشاء دالة ذرية لتعبئة المحفظة عبر Stripe
CREATE OR REPLACE FUNCTION public.process_stripe_wallet_deposit(
  p_user_id UUID,
  p_amount NUMERIC,
  p_stripe_session_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_tx_id UUID;
  v_new_tx_id UUID;
  v_new_balance NUMERIC;
BEGIN
  -- التحقق من عدم معالجة هذا الدفع سابقاً
  SELECT id INTO v_existing_tx_id
  FROM wallet_transactions
  WHERE stripe_session_id = p_stripe_session_id
  LIMIT 1;
  
  IF v_existing_tx_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Payment already processed',
      'already_processed', true
    );
  END IF;
  
  -- التحقق من صحة المبلغ
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid amount');
  END IF;
  
  -- قفل على مستوى المستخدم لمنع العمليات المتزامنة
  PERFORM pg_advisory_xact_lock(hashtext('wallet_deposit_' || p_user_id::text));
  
  -- إنشاء سجل المعاملة
  INSERT INTO wallet_transactions (
    user_id, 
    type, 
    amount, 
    status, 
    payment_method, 
    stripe_session_id
  )
  VALUES (
    p_user_id, 
    'deposit', 
    p_amount, 
    'completed', 
    'stripe', 
    p_stripe_session_id
  )
  RETURNING id INTO v_new_tx_id;
  
  -- تحديث أو إنشاء المحفظة بعملية ذرية واحدة
  INSERT INTO user_wallets (user_id, balance, currency)
  VALUES (p_user_id, p_amount, 'IQD')
  ON CONFLICT (user_id) DO UPDATE
  SET 
    balance = user_wallets.balance + p_amount,
    updated_at = now()
  RETURNING balance INTO v_new_balance;
  
  -- إرسال إشعار
  INSERT INTO notifications (user_id, title, message, type)
  VALUES (
    p_user_id,
    'تم تعبئة المحفظة',
    'تم إضافة ' || p_amount::TEXT || ' دينار عراقي إلى محفظتك عبر Stripe',
    'success'
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Wallet topped up successfully',
    'amount', p_amount,
    'new_balance', v_new_balance,
    'transaction_id', v_new_tx_id
  );
END;
$$;

-- منح صلاحيات التنفيذ
GRANT EXECUTE ON FUNCTION public.process_stripe_wallet_deposit TO service_role;

-- تحديث سياسة competition_prizes للسماح بطلب الشحن من حالة pending
DROP POLICY IF EXISTS "Users can request prize shipping" ON public.competition_prizes;

CREATE POLICY "Users can request prize shipping"
ON public.competition_prizes
FOR UPDATE
USING (auth.uid() = user_id AND status IN ('pending', 'won'))
WITH CHECK (auth.uid() = user_id AND status IN ('pending', 'won', 'shipping_requested'));

-- تحديث سياسة product_offer_purchases للسماح بتحديث حالة الشحن
DROP POLICY IF EXISTS "Users can update own purchases" ON public.product_offer_purchases;

CREATE POLICY "Users can update own purchases"
ON public.product_offer_purchases
FOR UPDATE
USING (auth.uid() = user_id AND purchase_status IN ('pending', 'purchased'))
WITH CHECK (auth.uid() = user_id AND purchase_status IN ('pending', 'purchased', 'shipping_requested'));