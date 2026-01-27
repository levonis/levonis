-- =====================================================
-- MORE SECURITY FIXES
-- =====================================================

-- 1. REMOVE user INSERT on competition_prizes (CRITICAL!)
-- Users should NOT be able to create prizes for themselves!
DROP POLICY IF EXISTS "Users can insert their own competition prizes" ON competition_prizes;

-- Only admins and system functions can insert prizes
-- The competition entry functions already handle this

-- 2. Restrict UPDATE on competition_prizes to specific fields only
DROP POLICY IF EXISTS "Users can update their own prize shipping status" ON competition_prizes;

-- Users can only update shipping_requested_at (to request shipping)
CREATE POLICY "Users can request prize shipping" ON competition_prizes
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- Add trigger to restrict what users can update
CREATE OR REPLACE FUNCTION public.restrict_prize_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    -- Users can only set shipping_requested_at if it was null
    IF OLD.shipping_requested_at IS NOT NULL AND NEW.shipping_requested_at != OLD.shipping_requested_at THEN
      RAISE EXCEPTION 'لقد طلبت الشحن مسبقاً';
    END IF;
    
    -- Users cannot change any other important fields
    IF NEW.prize_name_ar != OLD.prize_name_ar OR
       NEW.prize_value IS DISTINCT FROM OLD.prize_value OR
       NEW.status != OLD.status OR
       NEW.prize_type != OLD.prize_type OR
       NEW.product_id IS DISTINCT FROM OLD.product_id THEN
      RAISE EXCEPTION 'لا يمكنك تعديل هذه البيانات';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS restrict_prize_changes ON competition_prizes;
CREATE TRIGGER restrict_prize_changes
  BEFORE UPDATE ON competition_prizes
  FOR EACH ROW
  EXECUTE FUNCTION restrict_prize_update();

-- 3. Clean up duplicate policies on competition_tickets
DROP POLICY IF EXISTS "Admins can manage tickets" ON competition_tickets;
DROP POLICY IF EXISTS "Users can view their own tickets" ON competition_tickets;

-- 4. Verify daily_login_claims has RLS
ALTER TABLE IF EXISTS daily_login_claims ENABLE ROW LEVEL SECURITY;

-- Check if table exists before adding policies
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'daily_login_claims') THEN
    -- Drop existing policies
    DROP POLICY IF EXISTS "daily_login_user_select" ON daily_login_claims;
    DROP POLICY IF EXISTS "daily_login_user_insert" ON daily_login_claims;
    DROP POLICY IF EXISTS "daily_login_admin" ON daily_login_claims;
    
    -- User can only view their own
    EXECUTE 'CREATE POLICY "daily_login_user_select" ON daily_login_claims FOR SELECT TO authenticated USING (auth.uid() = user_id)';
    
    -- User can only insert for themselves
    EXECUTE 'CREATE POLICY "daily_login_user_insert" ON daily_login_claims FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)';
    
    -- Admin full access
    EXECUTE 'CREATE POLICY "daily_login_admin" ON daily_login_claims FOR ALL TO authenticated USING (has_role(auth.uid(), ''admin'')) WITH CHECK (has_role(auth.uid(), ''admin''))';
  END IF;
END $$;

-- 5. Prevent users from faking competition participation dates
CREATE OR REPLACE FUNCTION public.enforce_ticket_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Force purchased_at to be current time (prevent backdating)
  IF NOT has_role(auth.uid(), 'admin') THEN
    NEW.purchased_at := NOW();
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_ticket_time ON competition_tickets;
CREATE TRIGGER enforce_ticket_time
  BEFORE INSERT ON competition_tickets
  FOR EACH ROW
  EXECUTE FUNCTION enforce_ticket_timestamp();