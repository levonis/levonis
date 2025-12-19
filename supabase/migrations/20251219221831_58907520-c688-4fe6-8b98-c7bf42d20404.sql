
-- Create user_tickets table for ticket balance
CREATE TABLE public.user_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  ticket_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_tickets ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own tickets" 
ON public.user_tickets 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all tickets" 
ON public.user_tickets 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage tickets" 
ON public.user_tickets 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add required_tickets field to competitions
ALTER TABLE public.competitions 
ADD COLUMN required_tickets INTEGER NOT NULL DEFAULT 1;

-- Create function to purchase tickets with wallet
CREATE OR REPLACE FUNCTION public.purchase_tickets(ticket_quantity INTEGER, price_per_ticket NUMERIC)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  total_cost NUMERIC;
  current_balance NUMERIC;
  new_ticket_count INTEGER;
BEGIN
  IF current_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'غير مسجل الدخول');
  END IF;

  total_cost := ticket_quantity * price_per_ticket;

  -- Get current wallet balance
  SELECT balance INTO current_balance
  FROM user_wallets
  WHERE user_id = current_user_id;

  IF current_balance IS NULL OR current_balance < total_cost THEN
    RETURN json_build_object('success', false, 'error', 'رصيد المحفظة غير كافي');
  END IF;

  -- Deduct from wallet
  UPDATE user_wallets
  SET balance = balance - total_cost,
      updated_at = now()
  WHERE user_id = current_user_id;

  -- Add tickets to user
  INSERT INTO user_tickets (user_id, ticket_count)
  VALUES (current_user_id, ticket_quantity)
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    ticket_count = user_tickets.ticket_count + ticket_quantity,
    updated_at = now()
  RETURNING ticket_count INTO new_ticket_count;

  -- Record transaction
  INSERT INTO wallet_transactions (user_id, amount, type, status, admin_notes)
  VALUES (current_user_id, -total_cost, 'purchase', 'completed', 'شراء ' || ticket_quantity || ' تذكرة');

  RETURN json_build_object('success', true, 'new_ticket_count', new_ticket_count);
END;
$$;

-- Create function to enter competition with tickets
CREATE OR REPLACE FUNCTION public.enter_competition_with_tickets(comp_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  comp RECORD;
  current_tickets INTEGER;
  new_ticket_number TEXT;
  tickets_used INTEGER;
BEGIN
  IF current_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'غير مسجل الدخول');
  END IF;

  -- Get competition
  SELECT * INTO comp
  FROM competitions
  WHERE id = comp_id AND status = 'active';

  IF comp IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'المسابقة غير متاحة');
  END IF;

  tickets_used := comp.required_tickets;

  -- Get user tickets
  SELECT ticket_count INTO current_tickets
  FROM user_tickets
  WHERE user_id = current_user_id;

  IF current_tickets IS NULL OR current_tickets < tickets_used THEN
    RETURN json_build_object('success', false, 'error', 'لا يوجد تذاكر كافية');
  END IF;

  -- Check max tickets
  IF comp.max_tickets IS NOT NULL THEN
    DECLARE
      current_count INTEGER;
    BEGIN
      SELECT COUNT(*) INTO current_count
      FROM competition_tickets
      WHERE competition_id = comp_id;
      
      IF current_count >= comp.max_tickets THEN
        RETURN json_build_object('success', false, 'error', 'تم بيع جميع التذاكر');
      END IF;
    END;
  END IF;

  -- Deduct tickets
  UPDATE user_tickets
  SET ticket_count = ticket_count - tickets_used,
      updated_at = now()
  WHERE user_id = current_user_id;

  -- Generate ticket number
  new_ticket_number := generate_ticket_number(comp_id);

  -- Create competition ticket entry
  INSERT INTO competition_tickets (competition_id, user_id, ticket_number)
  VALUES (comp_id, current_user_id, new_ticket_number);

  RETURN json_build_object('success', true, 'ticket_number', new_ticket_number);
END;
$$;
