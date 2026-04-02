
-- Drop the duplicate function with wrong parameter types
DROP FUNCTION IF EXISTS public.check_stack_milestone(integer, text, uuid);
