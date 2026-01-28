-- 1. Add policy for admins to manage all print requests
CREATE POLICY "Admins can manage all print requests"
ON public.community_print_requests
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 2. Create a trigger to auto-create community_customer_profiles when profile is updated
CREATE OR REPLACE FUNCTION public.ensure_community_customer_profile()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert community profile if it doesn't exist
  INSERT INTO public.community_customer_profiles (
    user_id,
    display_name,
    avatar_url,
    bio
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.full_name, NEW.username),
    NEW.avatar_url,
    NEW.bio
  )
  ON CONFLICT (user_id) DO UPDATE SET
    display_name = COALESCE(EXCLUDED.display_name, community_customer_profiles.display_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, community_customer_profiles.avatar_url),
    bio = COALESCE(EXCLUDED.bio, community_customer_profiles.bio),
    updated_at = now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_profile_update_ensure_community ON public.profiles;

-- Create the trigger
CREATE TRIGGER on_profile_update_ensure_community
  AFTER INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_community_customer_profile();

-- 3. Add INSERT policy for users to create their own community profile
CREATE POLICY "Users can insert their own community profile"
ON public.community_customer_profiles
FOR INSERT
WITH CHECK (auth.uid() = user_id);