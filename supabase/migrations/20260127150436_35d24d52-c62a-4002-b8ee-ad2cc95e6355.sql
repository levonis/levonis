-- Clean up duplicate and conflicting policies on balance tables

-- Drop all user_tickets policies and recreate clean set
DROP POLICY IF EXISTS "Users can only SELECT their own tickets" ON user_tickets;
DROP POLICY IF EXISTS "Users can view their own user tickets" ON user_tickets;
DROP POLICY IF EXISTS "Admins can view all user tickets" ON user_tickets;
DROP POLICY IF EXISTS "Admins can manage user tickets" ON user_tickets;
DROP POLICY IF EXISTS "Users can only read own ticket balance" ON user_tickets;
DROP POLICY IF EXISTS "No direct writes to tickets" ON user_tickets;
DROP POLICY IF EXISTS "Admins can view all tickets" ON user_tickets;

-- Single clean SELECT policy for users on tickets
CREATE POLICY "user_tickets_select_own" ON user_tickets
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Admin full access
CREATE POLICY "user_tickets_admin_all" ON user_tickets
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Drop all user_wallets policies and recreate clean set
DROP POLICY IF EXISTS "Users can only SELECT their own wallet" ON user_wallets;
DROP POLICY IF EXISTS "Users can view their own wallet" ON user_wallets;
DROP POLICY IF EXISTS "Admins can view all wallets" ON user_wallets;
DROP POLICY IF EXISTS "Admins can insert wallets" ON user_wallets;
DROP POLICY IF EXISTS "Admins can update wallets" ON user_wallets;
DROP POLICY IF EXISTS "Users can only read own wallet balance" ON user_wallets;
DROP POLICY IF EXISTS "No direct writes to wallet" ON user_wallets;

-- Single clean SELECT policy for users on wallets
CREATE POLICY "user_wallets_select_own" ON user_wallets
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Admin full access
CREATE POLICY "user_wallets_admin_all" ON user_wallets
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Clean up user_points policies
DROP POLICY IF EXISTS "Users can view their own points" ON user_points;
DROP POLICY IF EXISTS "Admins can view all points" ON user_points;
DROP POLICY IF EXISTS "Users can only view their own points" ON user_points;
DROP POLICY IF EXISTS "System can insert user points" ON user_points;
DROP POLICY IF EXISTS "System can update user points" ON user_points;

-- Single clean SELECT policy for users on points
CREATE POLICY "user_points_select_own" ON user_points
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Admin full access
CREATE POLICY "user_points_admin_all" ON user_points
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));