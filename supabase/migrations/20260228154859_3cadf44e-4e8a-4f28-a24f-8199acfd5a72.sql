-- Fix UPDATE policies to include with_check clause

-- Profiles: add with_check to user update policy
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE 
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Community customer profiles: add with_check to user update policy  
DROP POLICY IF EXISTS "Users can update own profile" ON public.community_customer_profiles;
CREATE POLICY "Users can update own profile" 
ON public.community_customer_profiles FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);