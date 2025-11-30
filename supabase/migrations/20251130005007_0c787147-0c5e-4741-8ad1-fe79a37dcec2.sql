-- دالة لحذف الإشعارات القديمة (أكثر من 30 يوم)
CREATE OR REPLACE FUNCTION public.delete_old_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  DELETE FROM public.notifications
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$;

-- إضافة سياسة لحذف معاملات المحفظة بواسطة الأدمن
CREATE POLICY "Admins can delete transactions" 
ON public.wallet_transactions 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));