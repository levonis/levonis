-- Drop and recreate constraints with updated values
ALTER TABLE points_transactions DROP CONSTRAINT IF EXISTS points_transactions_source_check;
ALTER TABLE points_transactions DROP CONSTRAINT IF EXISTS points_transactions_type_check;

ALTER TABLE points_transactions 
ADD CONSTRAINT points_transactions_source_check 
CHECK (source = ANY (ARRAY['order', 'order_delivered', 'review', 'coupon', 'cash', 'daily_task', 'referral', 'referred', 'verified_review', 'wallet_conversion', 'admin_adjustment', 'tickets_conversion']::text[]));

ALTER TABLE points_transactions 
ADD CONSTRAINT points_transactions_type_check 
CHECK (type = ANY (ARRAY['earned', 'earn', 'redeemed', 'redeem', 'converted', 'adjustment']::text[]));