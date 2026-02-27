-- Allow admins to insert notifications for any user
CREATE POLICY "Admins can insert notifications"
ON public.notifications
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Allow admins to view all notifications  
CREATE POLICY "Admins can view all notifications"
ON public.notifications
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);