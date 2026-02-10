
-- 1. Tax rate per category
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS tax_rate numeric DEFAULT 0;

-- 2. Wallet PIN protection
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wallet_pin text DEFAULT NULL;

-- 3. Telegram notification preferences
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telegram_notifications jsonb DEFAULT '{"orders": true, "wallet": true, "competitions": true, "community": true, "promotions": true}'::jsonb;
