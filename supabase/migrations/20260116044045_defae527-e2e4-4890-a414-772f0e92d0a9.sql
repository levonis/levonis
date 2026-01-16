-- Drop existing insecure admin policies on parts_discount_requests
DROP POLICY IF EXISTS "Admins can view all discount requests" ON public.parts_discount_requests;
DROP POLICY IF EXISTS "Admins can update discount requests" ON public.parts_discount_requests;

-- Create new secure admin policies using has_role function
CREATE POLICY "Admins can view all discount requests"
ON public.parts_discount_requests
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update discount requests"
ON public.parts_discount_requests
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Add admin delete policy for completeness
CREATE POLICY "Admins can delete discount requests"
ON public.parts_discount_requests
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));