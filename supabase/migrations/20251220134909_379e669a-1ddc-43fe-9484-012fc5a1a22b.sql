-- Fix orders table RLS to require authentication
-- Drop existing policies and recreate with TO authenticated

DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can update all orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;
DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can create their own orders" ON public.orders;

-- Create SELECT policies with TO authenticated
CREATE POLICY "Users can view their own orders" 
ON public.orders 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all orders" 
ON public.orders 
FOR SELECT 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create INSERT policy with TO authenticated
CREATE POLICY "Users can create their own orders" 
ON public.orders 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Create UPDATE policy with TO authenticated
CREATE POLICY "Admins can update all orders" 
ON public.orders 
FOR UPDATE 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create DELETE policy with TO authenticated
CREATE POLICY "Admins can delete orders" 
ON public.orders 
FOR DELETE 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));