
-- Function to expire loyalty card codes and deactivate expired user cards
CREATE OR REPLACE FUNCTION public.expire_loyalty_codes_and_cards()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Expire unredeemed codes whose code_expires_at has passed
  UPDATE public.loyalty_card_codes
  SET status = 'expired',
      updated_at = now()
  WHERE status = 'active'
    AND code_expires_at IS NOT NULL
    AND code_expires_at < now();

  -- Deactivate user cards whose expires_at has passed
  UPDATE public.user_cards
  SET is_active = false,
      updated_at = now()
  WHERE is_active = true
    AND expires_at IS NOT NULL
    AND expires_at < now();
END;
$$;

-- Ensure required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove existing job if present, then schedule hourly
DO $$
BEGIN
  PERFORM cron.unschedule('expire-loyalty-codes-and-cards');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'expire-loyalty-codes-and-cards',
  '0 * * * *',
  $$ SELECT public.expire_loyalty_codes_and_cards(); $$
);

-- Run once now to clean up existing data
SELECT public.expire_loyalty_codes_and_cards();
