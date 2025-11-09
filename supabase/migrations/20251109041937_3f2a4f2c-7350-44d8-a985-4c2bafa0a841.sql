-- First, update existing profiles with null username to have a generated username
UPDATE public.profiles 
SET username = 'user_' || SUBSTRING(id::text, 1, 8)
WHERE username IS NULL OR username = '';

-- Add unique constraint to username in profiles table
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_username_unique UNIQUE (username);

-- Make username NOT NULL
ALTER TABLE public.profiles 
ALTER COLUMN username SET NOT NULL;

-- Add default avatar URL for guest users
ALTER TABLE public.profiles 
ALTER COLUMN avatar_url SET DEFAULT 'https://api.dicebear.com/7.x/avataaars/svg?seed=guest';

-- Update existing trigger to include username and set default avatar
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone_number, governorate, username, avatar_url)
  VALUES (
    new.id, 
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    COALESCE(new.raw_user_meta_data->>'phone_number', ''),
    COALESCE(new.raw_user_meta_data->>'governorate', ''),
    COALESCE(new.raw_user_meta_data->>'username', 'user_' || SUBSTRING(new.id::text, 1, 8)),
    COALESCE(new.raw_user_meta_data->>'avatar_url', 'https://api.dicebear.com/7.x/avataaars/svg?seed=' || new.id)
  );
  RETURN new;
END;
$$;

-- Create function to check username availability
CREATE OR REPLACE FUNCTION public.check_username_available(username_to_check TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE username = username_to_check
  );
END;
$$;