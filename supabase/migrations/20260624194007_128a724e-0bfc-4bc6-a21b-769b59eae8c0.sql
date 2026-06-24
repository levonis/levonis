-- Grant assistant role to hussain20041010@gmail.com (idempotent)
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'assistant'::public.app_role
FROM auth.users u
WHERE u.email = 'hussain20041010@gmail.com'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = u.id AND ur.role = 'assistant'::public.app_role
  );
