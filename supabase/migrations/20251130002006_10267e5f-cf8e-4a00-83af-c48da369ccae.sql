-- إضافة سياسة للسماح للأدمن بإضافة معاملات للمستخدمين
CREATE POLICY "Admins can insert transactions"
ON public.wallet_transactions
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));