-- Add payment method and checkout fields to chat_orders
ALTER TABLE public.chat_orders
ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'wallet' CHECK (payment_method IN ('wallet', 'cod', 'partial')),
ADD COLUMN IF NOT EXISTS partial_payment_percent integer DEFAULT NULL CHECK (partial_payment_percent IS NULL OR (partial_payment_percent >= 0 AND partial_payment_percent <= 100)),
ADD COLUMN IF NOT EXISTS commission_rate numeric(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS commission_amount numeric(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS delivery_address_id uuid REFERENCES public.user_addresses(id),
ADD COLUMN IF NOT EXISTS delivery_notes text,
ADD COLUMN IF NOT EXISTS paid_amount numeric(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS remaining_amount numeric(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS checkout_completed_at timestamptz,
ADD COLUMN IF NOT EXISTS description text;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_chat_orders_customer_status ON public.chat_orders(customer_id, status);
CREATE INDEX IF NOT EXISTS idx_chat_orders_seller_status ON public.chat_orders(seller_id, status);

-- Enable RLS if not already
ALTER TABLE public.chat_orders ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any and recreate
DROP POLICY IF EXISTS "Users can view their chat orders" ON public.chat_orders;
DROP POLICY IF EXISTS "Sellers can create orders" ON public.chat_orders;
DROP POLICY IF EXISTS "Users can update their chat orders" ON public.chat_orders;

-- Allow users to view orders where they are buyer or seller
CREATE POLICY "Users can view their chat orders"
ON public.chat_orders
FOR SELECT
USING (auth.uid() = customer_id OR auth.uid() = seller_id);

-- Allow sellers to create orders
CREATE POLICY "Sellers can create orders"
ON public.chat_orders
FOR INSERT
WITH CHECK (auth.uid() = seller_id OR auth.uid() = customer_id);

-- Allow participants to update orders
CREATE POLICY "Users can update their chat orders"
ON public.chat_orders
FOR UPDATE
USING (auth.uid() = customer_id OR auth.uid() = seller_id);