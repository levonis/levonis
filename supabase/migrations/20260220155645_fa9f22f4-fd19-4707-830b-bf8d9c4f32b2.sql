
-- Add last_active_at to profiles for online status tracking
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Create function to update last_active_at
CREATE OR REPLACE FUNCTION public.update_user_last_active()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE profiles SET last_active_at = now() WHERE id = auth.uid();
$$;
