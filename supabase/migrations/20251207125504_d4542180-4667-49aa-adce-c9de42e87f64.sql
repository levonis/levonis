-- Drop the current overly permissive policy
DROP POLICY IF EXISTS "Service role can manage admin_telegram_context" ON admin_telegram_context;

-- Create restrictive policy that blocks all client access
-- Edge functions using service role key bypass RLS, so this still allows server-side operations
CREATE POLICY "Block all client access to admin_telegram_context" 
ON admin_telegram_context 
FOR ALL 
USING (false) 
WITH CHECK (false);