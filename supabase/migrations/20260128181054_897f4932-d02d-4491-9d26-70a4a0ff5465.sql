-- Fix function search path for security
ALTER FUNCTION public.ensure_community_customer_profile() SET search_path = public;