-- Drop the overly permissive RLS policy that allows all authenticated users to access all profiles
DROP POLICY IF EXISTS "Require authentication for all profile access" ON public.profiles;