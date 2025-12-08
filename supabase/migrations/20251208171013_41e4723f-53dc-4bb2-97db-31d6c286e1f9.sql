-- Drop the old constraint
ALTER TABLE public.points_transactions DROP CONSTRAINT IF EXISTS points_transactions_source_check;

-- Add the updated constraint with all valid sources
ALTER TABLE public.points_transactions 
ADD CONSTRAINT points_transactions_source_check 
CHECK (source = ANY (ARRAY['order', 'review', 'coupon', 'cash', 'daily_task', 'referral', 'referred', 'verified_review', 'wallet_conversion']));