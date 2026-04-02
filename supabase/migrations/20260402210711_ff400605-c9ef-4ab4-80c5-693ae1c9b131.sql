-- Drop the old check_stack_milestone overload that uses uuid session_id
-- This old version calls deduct_prize_stock with only 1 arg (no variant stock support)
DROP FUNCTION IF EXISTS public.check_stack_milestone(uuid, integer, uuid);

-- Also drop old 1-arg deduct_prize_stock that doesn't support variant stock
DROP FUNCTION IF EXISTS public.deduct_prize_stock(uuid);

-- Drop the old 3-arg overload (uuid, uuid, text) that doesn't support variant stock
DROP FUNCTION IF EXISTS public.deduct_prize_stock(uuid, uuid, text);