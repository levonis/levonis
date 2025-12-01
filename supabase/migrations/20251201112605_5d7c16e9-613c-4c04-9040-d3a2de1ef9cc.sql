-- Drop and recreate the handle_new_user function with better unique username generation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path TO 'public'
AS $$
DECLARE
  new_username text;
  username_exists boolean;
BEGIN
  -- Generate a unique username
  new_username := COALESCE(
    new.raw_user_meta_data->>'username',
    'user_' || SUBSTRING(new.id::text, 1, 8) || '_' || FLOOR(RANDOM() * 10000)::text
  );
  
  -- Check if username exists and regenerate if needed
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE username = new_username) INTO username_exists;
  
  WHILE username_exists LOOP
    new_username := 'user_' || SUBSTRING(new.id::text, 1, 8) || '_' || FLOOR(RANDOM() * 100000)::text;
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE username = new_username) INTO username_exists;
  END LOOP;
  
  INSERT INTO public.profiles (id, email, full_name, phone_number, governorate, username, avatar_url)
  VALUES (
    new.id, 
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    COALESCE(new.raw_user_meta_data->>'phone_number', ''),
    COALESCE(new.raw_user_meta_data->>'governorate', ''),
    new_username,
    COALESCE(new.raw_user_meta_data->>'avatar_url', 'https://api.dicebear.com/7.x/avataaars/svg?seed=' || new.id)
  );
  RETURN new;
END;
$$;