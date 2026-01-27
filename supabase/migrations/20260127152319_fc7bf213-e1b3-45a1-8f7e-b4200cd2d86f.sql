
-- Add admin policy for chat_orders if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'chat_orders' 
    AND policyname = 'Admins can manage all chat orders'
  ) THEN
    CREATE POLICY "Admins can manage all chat orders"
      ON public.chat_orders
      FOR ALL
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- Fix the insert policy - make sure sellers can create orders properly
DROP POLICY IF EXISTS "Sellers can create orders" ON chat_orders;
DROP POLICY IF EXISTS "Users can create orders as customers" ON chat_orders;

-- Single comprehensive insert policy
CREATE POLICY "Participants can create chat orders"
  ON public.chat_orders
  FOR INSERT
  WITH CHECK (auth.uid() = seller_id OR auth.uid() = customer_id);
