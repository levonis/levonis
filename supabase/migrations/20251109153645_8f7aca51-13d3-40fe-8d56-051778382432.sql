-- إضافة سياسة للسماح للأدمن بقراءة جميع الملفات الشخصية
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));