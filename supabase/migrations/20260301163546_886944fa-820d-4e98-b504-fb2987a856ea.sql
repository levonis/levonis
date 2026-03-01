
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS site_notifications JSONB DEFAULT '{"orders": true, "wallet": true, "community": true, "promotions": true, "competitions": true}'::jsonb;
