-- Fix linter warning: set explicit search_path on helper function
CREATE OR REPLACE FUNCTION public.normalize_text_key(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT regexp_replace(trim(lower(coalesce(p_text, ''))), '\s+', ' ', 'g');
$$;