-- Create entry log table for security auditing
CREATE TABLE IF NOT EXISTS public.competition_entry_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  competition_id UUID NOT NULL,
  tickets_requested INTEGER NOT NULL,
  tickets_deducted INTEGER,
  success BOOLEAN DEFAULT FALSE,
  error_message TEXT,
  user_balance_before INTEGER,
  user_balance_after INTEGER,
  ip_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.competition_entry_log ENABLE ROW LEVEL SECURITY;

-- Admins only can view logs
CREATE POLICY "Only admins can view entry logs" ON public.competition_entry_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Create advisory lock key function for user-level locking
CREATE OR REPLACE FUNCTION get_user_lock_key(p_user_id UUID)
RETURNS BIGINT 
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ('x' || replace(p_user_id::text, '-', ''))::bit(64)::bigint;
$$;

-- Index for faster fraud detection queries
CREATE INDEX IF NOT EXISTS idx_competition_entry_log_user_time 
  ON competition_entry_log(user_id, created_at DESC);
  
CREATE INDEX IF NOT EXISTS idx_competition_tickets_user_purchased 
  ON competition_tickets(user_id, purchased_at DESC);

-- Add constraints to prevent negative balances
ALTER TABLE user_tickets DROP CONSTRAINT IF EXISTS check_positive_tickets;
ALTER TABLE user_tickets ADD CONSTRAINT check_positive_tickets CHECK (ticket_count >= 0);

ALTER TABLE user_wallets DROP CONSTRAINT IF EXISTS check_positive_balance;
ALTER TABLE user_wallets ADD CONSTRAINT check_positive_balance CHECK (balance >= 0);