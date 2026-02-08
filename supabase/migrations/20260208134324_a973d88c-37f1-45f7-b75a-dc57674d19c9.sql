-- =============================================
-- SECURITY FIX: Profiles Table - Restrict Public Access (Corrected)
-- =============================================

-- Drop existing overly permissive SELECT policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own full profile" ON public.profiles;

-- Create restricted SELECT policy - users can only see their own profile
CREATE POLICY "Users can view own full profile"
ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = id);

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- SECURITY FIX: Conversations Table - Message Privacy (Corrected)
-- =============================================

-- Drop any existing policies first
DROP POLICY IF EXISTS "Users can view all conversations" ON public.conversations;
DROP POLICY IF EXISTS "Anyone can view conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can only view own conversations" ON public.conversations;

-- Ensure users can only view their own conversations
CREATE POLICY "Users can only view own conversations"
ON public.conversations FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- =============================================
-- SECURITY FIX: Messages Table - Message Privacy (Corrected)
-- =============================================

-- Drop any existing policies first
DROP POLICY IF EXISTS "Users can view all messages" ON public.messages;
DROP POLICY IF EXISTS "Anyone can view messages" ON public.messages;
DROP POLICY IF EXISTS "Users can only view messages from own conversations" ON public.messages;

-- Ensure users can only view messages from their own conversations
CREATE POLICY "Users can only view messages from own conversations"
ON public.messages FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.conversations c 
    WHERE c.id = conversation_id 
    AND (c.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);