-- Create chat_orders table for managing orders within conversations
CREATE TABLE public.chat_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.listing_conversations(id) ON DELETE CASCADE,
  product_id UUID,
  product_title TEXT NOT NULL,
  product_image TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'created',
  seller_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create chat_order_modifications table for tracking price/terms changes
CREATE TABLE public.chat_order_modifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.chat_orders(id) ON DELETE CASCADE,
  change_type TEXT NOT NULL DEFAULT 'price_change',
  old_value TEXT NOT NULL,
  new_value TEXT NOT NULL,
  seller_note TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add message_type column to listing_messages if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'listing_messages' 
    AND column_name = 'message_type'
  ) THEN
    ALTER TABLE public.listing_messages ADD COLUMN message_type TEXT DEFAULT 'text';
  END IF;
END $$;

-- Enable RLS
ALTER TABLE public.chat_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_order_modifications ENABLE ROW LEVEL SECURITY;

-- RLS policies for chat_orders
CREATE POLICY "Users can view their own orders"
ON public.chat_orders
FOR SELECT
USING (auth.uid() = seller_id OR auth.uid() = customer_id);

CREATE POLICY "Users can create orders as customers"
ON public.chat_orders
FOR INSERT
WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Order participants can update orders"
ON public.chat_orders
FOR UPDATE
USING (auth.uid() = seller_id OR auth.uid() = customer_id);

-- RLS policies for chat_order_modifications
CREATE POLICY "Order participants can view modifications"
ON public.chat_order_modifications
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.chat_orders 
    WHERE chat_orders.id = chat_order_modifications.order_id 
    AND (chat_orders.seller_id = auth.uid() OR chat_orders.customer_id = auth.uid())
  )
);

CREATE POLICY "Sellers can create modifications"
ON public.chat_order_modifications
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chat_orders 
    WHERE chat_orders.id = order_id 
    AND chat_orders.seller_id = auth.uid()
  )
);

CREATE POLICY "Order participants can update modifications"
ON public.chat_order_modifications
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.chat_orders 
    WHERE chat_orders.id = chat_order_modifications.order_id 
    AND (chat_orders.seller_id = auth.uid() OR chat_orders.customer_id = auth.uid())
  )
);

-- Create indexes for performance
CREATE INDEX idx_chat_orders_conversation_id ON public.chat_orders(conversation_id);
CREATE INDEX idx_chat_orders_seller_id ON public.chat_orders(seller_id);
CREATE INDEX idx_chat_orders_customer_id ON public.chat_orders(customer_id);
CREATE INDEX idx_chat_orders_status ON public.chat_orders(status);
CREATE INDEX idx_chat_order_modifications_order_id ON public.chat_order_modifications(order_id);

-- Trigger for updated_at
CREATE TRIGGER update_chat_orders_updated_at
BEFORE UPDATE ON public.chat_orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();