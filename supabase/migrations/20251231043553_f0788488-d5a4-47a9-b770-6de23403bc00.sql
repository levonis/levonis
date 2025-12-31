-- إنشاء جدول مستقل لعروض المنتجات
CREATE TABLE public.product_offers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  description TEXT,
  description_ar TEXT,
  image_url TEXT,
  images TEXT[] DEFAULT ARRAY[]::TEXT[],
  price NUMERIC NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'دينار',
  gift_tickets INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'inactive')),
  stock_quantity INTEGER,
  total_sold INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_offers ENABLE ROW LEVEL SECURITY;

-- Anyone can view active offers
CREATE POLICY "Anyone can view active product offers"
ON public.product_offers
FOR SELECT
USING (status = 'active');

-- Admins can manage all offers
CREATE POLICY "Admins can manage product offers"
ON public.product_offers
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- جدول مشتريات عروض المنتجات
CREATE TABLE public.product_offer_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  offer_id UUID NOT NULL REFERENCES public.product_offers(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL,
  gift_tickets_awarded INTEGER NOT NULL,
  purchase_status TEXT NOT NULL DEFAULT 'purchased' CHECK (purchase_status IN ('purchased', 'shipped', 'delivered', 'cancelled')),
  shipping_requested_at TIMESTAMP WITH TIME ZONE,
  shipped_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_offer_purchases ENABLE ROW LEVEL SECURITY;

-- Require authentication
CREATE POLICY "Require auth for purchases"
ON public.product_offer_purchases
AS RESTRICTIVE
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Users can view their own purchases
CREATE POLICY "Users can view own purchases"
ON public.product_offer_purchases
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own purchases (via RPC)
CREATE POLICY "Users can insert own purchases"
ON public.product_offer_purchases
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update own purchases (for shipping requests)
CREATE POLICY "Users can update own purchases"
ON public.product_offer_purchases
FOR UPDATE
USING (auth.uid() = user_id);

-- Admins can manage all purchases
CREATE POLICY "Admins can manage all purchases"
ON public.product_offer_purchases
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RPC function لشراء عرض منتج
CREATE OR REPLACE FUNCTION public.purchase_product_offer(
  p_offer_id UUID,
  p_quantity INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id UUID;
  offer_record RECORD;
  total_cost NUMERIC;
  total_tickets INTEGER;
  wallet_balance NUMERIC;
  new_purchase_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'غير مصرح');
  END IF;
  
  IF p_quantity < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'الكمية غير صالحة');
  END IF;
  
  -- Get offer details
  SELECT * INTO offer_record FROM product_offers WHERE id = p_offer_id AND status = 'active';
  
  IF offer_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'العرض غير متوفر');
  END IF;
  
  -- Check stock
  IF offer_record.stock_quantity IS NOT NULL AND offer_record.stock_quantity < p_quantity THEN
    RETURN jsonb_build_object('success', false, 'error', 'الكمية المطلوبة غير متوفرة');
  END IF;
  
  total_cost := offer_record.price * p_quantity;
  total_tickets := offer_record.gift_tickets * p_quantity;
  
  -- Check wallet balance
  SELECT balance INTO wallet_balance FROM user_wallets WHERE user_id = current_user_id;
  
  IF wallet_balance IS NULL OR wallet_balance < total_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'رصيد المحفظة غير كافٍ');
  END IF;
  
  -- Deduct from wallet
  UPDATE user_wallets
  SET balance = balance - total_cost, updated_at = now()
  WHERE user_id = current_user_id;
  
  -- Record transaction
  INSERT INTO wallet_transactions (user_id, type, amount, status, admin_notes)
  VALUES (current_user_id, 'product_purchase', -total_cost, 'completed', 
          'شراء ' || p_quantity || ' من ' || offer_record.title_ar);
  
  -- Create purchase record
  INSERT INTO product_offer_purchases (
    user_id, offer_id, quantity, unit_price, total_price, gift_tickets_awarded
  ) VALUES (
    current_user_id, p_offer_id, p_quantity, offer_record.price, total_cost, total_tickets
  ) RETURNING id INTO new_purchase_id;
  
  -- Update stock
  IF offer_record.stock_quantity IS NOT NULL THEN
    UPDATE product_offers
    SET stock_quantity = stock_quantity - p_quantity,
        total_sold = total_sold + p_quantity,
        updated_at = now()
    WHERE id = p_offer_id;
  ELSE
    UPDATE product_offers
    SET total_sold = total_sold + p_quantity,
        updated_at = now()
    WHERE id = p_offer_id;
  END IF;
  
  -- Add gift tickets to user
  INSERT INTO user_tickets (user_id, ticket_count)
  VALUES (current_user_id, total_tickets)
  ON CONFLICT (user_id) DO UPDATE
  SET ticket_count = user_tickets.ticket_count + total_tickets,
      updated_at = now();
  
  RETURN jsonb_build_object(
    'success', true,
    'purchase_id', new_purchase_id,
    'total_cost', total_cost,
    'gift_tickets', total_tickets,
    'product_name', offer_record.title_ar
  );
END;
$$;

-- RPC function لطلب شحن المشتريات
CREATE OR REPLACE FUNCTION public.request_offer_shipment(
  p_purchase_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id UUID;
  updated_count INTEGER;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'غير مصرح');
  END IF;
  
  UPDATE product_offer_purchases
  SET purchase_status = 'shipped',
      shipping_requested_at = now(),
      updated_at = now()
  WHERE id = ANY(p_purchase_ids)
    AND user_id = current_user_id
    AND purchase_status = 'purchased';
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  IF updated_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'لم يتم العثور على مشتريات للشحن');
  END IF;
  
  RETURN jsonb_build_object('success', true, 'message', 'تم طلب شحن ' || updated_count || ' منتج');
END;
$$;

-- Trigger for updated_at
CREATE TRIGGER update_product_offers_updated_at
BEFORE UPDATE ON public.product_offers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_product_offer_purchases_updated_at
BEFORE UPDATE ON public.product_offer_purchases
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();