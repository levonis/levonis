-- Update handle_new_user to generate username from email prefix for OAuth users (Google, etc.)
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  provided_username text;
  final_username text;
  username_exists boolean;
  email_prefix text;
  base_username text;
  counter integer := 0;
  oauth_avatar text;
  oauth_full_name text;
BEGIN
  -- Pull data from metadata
  provided_username := new.raw_user_meta_data->>'username';
  oauth_full_name := COALESCE(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    ''
  );
  oauth_avatar := COALESCE(
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'picture',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=' || new.id
  );

  -- 1) explicit username (email/password signup flow)
  IF provided_username IS NOT NULL AND provided_username != '' THEN
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE LOWER(username) = LOWER(provided_username)) INTO username_exists;
    IF NOT username_exists THEN
      final_username := provided_username;
    ELSE
      final_username := provided_username || '_' || SUBSTRING(new.id::text, 1, 4);
    END IF;
  ELSE
    -- 2) OAuth path: derive from email prefix
    IF new.email IS NOT NULL AND new.email != '' THEN
      email_prefix := SPLIT_PART(new.email, '@', 1);
      -- sanitize: keep alnum, dot, underscore, hyphen
      email_prefix := REGEXP_REPLACE(email_prefix, '[^a-zA-Z0-9._-]', '', 'g');
      IF email_prefix = '' THEN
        email_prefix := 'user';
      END IF;
      base_username := email_prefix;
    ELSE
      base_username := 'user_' || SUBSTRING(new.id::text, 1, 8);
    END IF;

    final_username := base_username;
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE LOWER(username) = LOWER(final_username)) INTO username_exists;
    WHILE username_exists AND counter < 1000 LOOP
      counter := counter + 1;
      final_username := base_username || counter::text;
      SELECT EXISTS(SELECT 1 FROM public.profiles WHERE LOWER(username) = LOWER(final_username)) INTO username_exists;
    END LOOP;
    IF username_exists THEN
      final_username := base_username || '_' || SUBSTRING(new.id::text, 1, 6);
    END IF;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, phone_number, governorate, username, avatar_url, email_verified)
  VALUES (
    new.id,
    new.email,
    oauth_full_name,
    COALESCE(new.raw_user_meta_data->>'phone_number', ''),
    COALESCE(new.raw_user_meta_data->>'governorate', ''),
    final_username,
    oauth_avatar,
    COALESCE((new.raw_user_meta_data->>'email_verified')::boolean, new.email_confirmed_at IS NOT NULL, false)
  );
  RETURN new;
END;
$function$;