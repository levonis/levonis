-- Create shipment_requests table for proper tracking
CREATE TABLE public.shipment_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  tracking_number TEXT,
  shipped_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  admin_notes TEXT,
  shipping_address TEXT,
  phone_number TEXT,
  governorate TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create shipment_request_items table
CREATE TABLE public.shipment_request_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shipment_request_id UUID NOT NULL REFERENCES public.shipment_requests(id) ON DELETE CASCADE,
  purchased_product_id UUID NOT NULL REFERENCES public.user_purchased_products(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add indexes
CREATE INDEX idx_shipment_requests_user_id ON public.shipment_requests(user_id);
CREATE INDEX idx_shipment_requests_status ON public.shipment_requests(status);
CREATE INDEX idx_shipment_request_items_request ON public.shipment_request_items(shipment_request_id);

-- Enable RLS
ALTER TABLE public.shipment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_request_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for shipment_requests
CREATE POLICY "Users can view their own shipment requests" 
ON public.shipment_requests 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own shipment requests" 
ON public.shipment_requests 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all shipment requests" 
ON public.shipment_requests 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update any shipment request" 
ON public.shipment_requests 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage shipment requests" 
ON public.shipment_requests 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for shipment_request_items
CREATE POLICY "Users can view their own shipment request items" 
ON public.shipment_request_items 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.shipment_requests sr 
  WHERE sr.id = shipment_request_id AND sr.user_id = auth.uid()
));

CREATE POLICY "Users can create shipment request items" 
ON public.shipment_request_items 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.shipment_requests sr 
  WHERE sr.id = shipment_request_id AND sr.user_id = auth.uid()
));

CREATE POLICY "Admins can manage shipment request items" 
ON public.shipment_request_items 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add shipped_at column to user_purchased_products if missing
ALTER TABLE public.user_purchased_products ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.user_purchased_products ADD COLUMN IF NOT EXISTS shipment_request_id UUID REFERENCES public.shipment_requests(id);

-- Update RPC function for delivery request
CREATE OR REPLACE FUNCTION public.request_product_delivery(p_product_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id UUID;
  product_count INTEGER;
  new_request_id UUID;
  user_address TEXT;
  user_phone TEXT;
  user_gov TEXT;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'غير مصرح');
  END IF;

  -- Check if any valid products exist
  SELECT COUNT(*) INTO product_count
  FROM user_purchased_products
  WHERE id = ANY(p_product_ids)
    AND user_id = current_user_id
    AND order_status = 'not_ordered'
    AND NOT listed_in_marketplace;

  IF product_count = 0 THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'لا توجد منتجات متاحة للتوصيل. تأكد من أن المنتجات لم تُطلب مسبقاً.'
    );
  END IF;

  -- Get user info for shipping
  SELECT 
    COALESCE(ua.address, ''),
    COALESCE(p.phone_number, ''),
    COALESCE(p.governorate, '')
  INTO user_address, user_phone, user_gov
  FROM profiles p
  LEFT JOIN (
    SELECT user_id, address FROM user_addresses WHERE is_default = true LIMIT 1
  ) ua ON ua.user_id = p.id
  WHERE p.id = current_user_id;

  -- Create shipment request
  INSERT INTO shipment_requests (user_id, shipping_address, phone_number, governorate)
  VALUES (current_user_id, user_address, user_phone, user_gov)
  RETURNING id INTO new_request_id;

  -- Add items to shipment request and update product status
  INSERT INTO shipment_request_items (shipment_request_id, purchased_product_id)
  SELECT new_request_id, id
  FROM user_purchased_products
  WHERE id = ANY(p_product_ids)
    AND user_id = current_user_id
    AND order_status = 'not_ordered'
    AND NOT listed_in_marketplace;

  -- Update product status
  UPDATE user_purchased_products
  SET order_status = 'ordered',
      ordered_at = now(),
      shipment_request_id = new_request_id,
      updated_at = now()
  WHERE id = ANY(p_product_ids)
    AND user_id = current_user_id
    AND order_status = 'not_ordered';

  GET DIAGNOSTICS product_count = ROW_COUNT;

  -- Send notification
  INSERT INTO notifications (user_id, title, message, type)
  VALUES (
    current_user_id,
    'تم تسجيل طلب التوصيل ✅',
    'تم تسجيل طلب توصيل ' || product_count || ' منتج. سيتم التواصل معك قريباً.',
    'success'
  );

  RETURN jsonb_build_object(
    'success', true,
    'products_ordered', product_count,
    'request_id', new_request_id,
    'message', 'تم تسجيل طلب التوصيل بنجاح!'
  );
END;
$$;