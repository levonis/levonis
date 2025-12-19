-- Drop and recreate the handle_new_user function to properly use the username from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  provided_username text;
  final_username text;
  username_exists boolean;
BEGIN
  -- Get username from user metadata (set during signup)
  provided_username := new.raw_user_meta_data->>'username';
  
  -- If username was provided, try to use it
  IF provided_username IS NOT NULL AND provided_username != '' THEN
    -- Check if this username already exists
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE username = provided_username) INTO username_exists;
    
    IF NOT username_exists THEN
      -- Use the provided username
      final_username := provided_username;
    ELSE
      -- Username exists, generate a unique one
      final_username := 'user_' || SUBSTRING(new.id::text, 1, 8);
      SELECT EXISTS(SELECT 1 FROM public.profiles WHERE username = final_username) INTO username_exists;
      WHILE username_exists LOOP
        final_username := 'user_' || SUBSTRING(new.id::text, 1, 8) || '_' || FLOOR(RANDOM() * 100000)::text;
        SELECT EXISTS(SELECT 1 FROM public.profiles WHERE username = final_username) INTO username_exists;
      END LOOP;
    END IF;
  ELSE
    -- No username provided, generate one
    final_username := 'user_' || SUBSTRING(new.id::text, 1, 8);
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE username = final_username) INTO username_exists;
    WHILE username_exists LOOP
      final_username := 'user_' || SUBSTRING(new.id::text, 1, 8) || '_' || FLOOR(RANDOM() * 100000)::text;
      SELECT EXISTS(SELECT 1 FROM public.profiles WHERE username = final_username) INTO username_exists;
    END LOOP;
  END IF;
  
  INSERT INTO public.profiles (id, email, full_name, phone_number, governorate, username, avatar_url)
  VALUES (
    new.id, 
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    COALESCE(new.raw_user_meta_data->>'phone_number', ''),
    COALESCE(new.raw_user_meta_data->>'governorate', ''),
    final_username,
    COALESCE(new.raw_user_meta_data->>'avatar_url', 'https://api.dicebear.com/7.x/avataaars/svg?seed=' || new.id)
  );
  RETURN new;
END;
$$;