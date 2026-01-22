-- Fix linter issues introduced/related to our changes

-- 1) Ensure view runs with invoker privileges (not definer)
ALTER VIEW public.user_print_reputation SET (security_invoker = true);

-- 2) Lock down function search_path
ALTER FUNCTION public.compute_overall_print_score(numeric, numeric, numeric, numeric, numeric)
  SET search_path = public;