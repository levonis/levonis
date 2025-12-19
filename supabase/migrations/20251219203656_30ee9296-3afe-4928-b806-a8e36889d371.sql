
-- Create competition type enum
CREATE TYPE public.competition_type AS ENUM ('ticket_count', 'all_tickets_sold', 'timed', 'free');

-- Create competition status enum  
CREATE TYPE public.competition_status AS ENUM ('draft', 'active', 'completed', 'cancelled');

-- Create competitions table
CREATE TABLE public.competitions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  description TEXT,
  description_ar TEXT,
  image_url TEXT,
  prize_description TEXT NOT NULL,
  prize_description_ar TEXT NOT NULL,
  prize_value NUMERIC,
  ticket_price NUMERIC NOT NULL DEFAULT 0,
  max_tickets INTEGER,
  target_participants INTEGER,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  end_date TIMESTAMP WITH TIME ZONE,
  draw_date TIMESTAMP WITH TIME ZONE,
  competition_type competition_type NOT NULL DEFAULT 'ticket_count',
  status competition_status NOT NULL DEFAULT 'draft',
  winner_user_id UUID REFERENCES auth.users(id),
  winner_ticket_id UUID,
  currency TEXT NOT NULL DEFAULT 'دينار عراقي',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create competition tickets table
CREATE TABLE public.competition_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  competition_id UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticket_number TEXT NOT NULL,
  purchased_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_winner BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(competition_id, ticket_number)
);

-- Enable RLS
ALTER TABLE public.competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_tickets ENABLE ROW LEVEL SECURITY;

-- RLS policies for competitions
CREATE POLICY "Anyone can view active competitions"
ON public.competitions
FOR SELECT
USING (status = 'active' OR status = 'completed');

CREATE POLICY "Admins can manage competitions"
ON public.competitions
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for competition tickets
CREATE POLICY "Users can view their own tickets"
ON public.competition_tickets
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view tickets for public competitions"
ON public.competition_tickets
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.competitions 
  WHERE id = competition_id 
  AND (status = 'active' OR status = 'completed')
));

CREATE POLICY "Users can purchase tickets"
ON public.competition_tickets
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage tickets"
ON public.competition_tickets
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Function to generate unique ticket number
CREATE OR REPLACE FUNCTION public.generate_ticket_number(comp_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_number TEXT;
  ticket_count INTEGER;
BEGIN
  SELECT COUNT(*) + 1 INTO ticket_count
  FROM competition_tickets
  WHERE competition_id = comp_id;
  
  new_number := 'TKT-' || LPAD(ticket_count::TEXT, 6, '0');
  RETURN new_number;
END;
$$;

-- Function to purchase ticket
CREATE OR REPLACE FUNCTION public.purchase_competition_ticket(comp_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID;
  comp_record RECORD;
  ticket_count INTEGER;
  new_ticket_id UUID;
  new_ticket_number TEXT;
  user_wallet_balance NUMERIC;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'غير مصرح');
  END IF;

  -- Get competition details
  SELECT * INTO comp_record
  FROM competitions
  WHERE id = comp_id AND status = 'active';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'المسابقة غير موجودة أو غير نشطة');
  END IF;

  -- Check if timed competition has ended
  IF comp_record.competition_type = 'timed' AND comp_record.end_date < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'انتهى وقت المسابقة');
  END IF;

  -- Check max tickets
  IF comp_record.max_tickets IS NOT NULL THEN
    SELECT COUNT(*) INTO ticket_count
    FROM competition_tickets
    WHERE competition_id = comp_id;
    
    IF ticket_count >= comp_record.max_tickets THEN
      RETURN jsonb_build_object('success', false, 'error', 'نفذت جميع التذاكر');
    END IF;
  END IF;

  -- If not free, check wallet balance and deduct
  IF comp_record.ticket_price > 0 THEN
    SELECT balance INTO user_wallet_balance
    FROM user_wallets
    WHERE user_id = current_user_id;
    
    IF user_wallet_balance IS NULL OR user_wallet_balance < comp_record.ticket_price THEN
      RETURN jsonb_build_object('success', false, 'error', 'رصيد المحفظة غير كافٍ');
    END IF;
    
    -- Deduct from wallet
    UPDATE user_wallets
    SET balance = balance - comp_record.ticket_price,
        updated_at = now()
    WHERE user_id = current_user_id;
    
    -- Record wallet transaction
    INSERT INTO wallet_transactions (user_id, type, amount, status)
    VALUES (current_user_id, 'competition_ticket', -comp_record.ticket_price, 'completed');
  END IF;

  -- Generate ticket number
  new_ticket_number := generate_ticket_number(comp_id);

  -- Create ticket
  INSERT INTO competition_tickets (competition_id, user_id, ticket_number)
  VALUES (comp_id, current_user_id, new_ticket_number)
  RETURNING id INTO new_ticket_id;

  -- Send notification
  INSERT INTO notifications (user_id, title, message, type, related_id)
  VALUES (
    current_user_id,
    'تم شراء تذكرة المسابقة',
    'تم شراء تذكرة للمسابقة: ' || comp_record.title_ar || ' - رقم التذكرة: ' || new_ticket_number,
    'success',
    new_ticket_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'ticket_id', new_ticket_id,
    'ticket_number', new_ticket_number
  );
END;
$$;

-- Function to draw winner
CREATE OR REPLACE FUNCTION public.draw_competition_winner(comp_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  comp_record RECORD;
  winner_ticket RECORD;
  winner_profile RECORD;
BEGIN
  -- Check if admin
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'غير مصرح');
  END IF;

  -- Get competition
  SELECT * INTO comp_record
  FROM competitions
  WHERE id = comp_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'المسابقة غير موجودة');
  END IF;

  IF comp_record.status = 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'تم السحب على هذه المسابقة مسبقاً');
  END IF;

  -- Select random winner
  SELECT * INTO winner_ticket
  FROM competition_tickets
  WHERE competition_id = comp_id
  ORDER BY random()
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'لا يوجد مشاركين في المسابقة');
  END IF;

  -- Update competition
  UPDATE competitions
  SET 
    status = 'completed',
    winner_user_id = winner_ticket.user_id,
    winner_ticket_id = winner_ticket.id,
    draw_date = now(),
    updated_at = now()
  WHERE id = comp_id;

  -- Mark winning ticket
  UPDATE competition_tickets
  SET is_winner = true
  WHERE id = winner_ticket.id;

  -- Get winner profile
  SELECT * INTO winner_profile
  FROM profiles
  WHERE id = winner_ticket.user_id;

  -- Notify winner
  INSERT INTO notifications (user_id, title, message, type, related_id)
  VALUES (
    winner_ticket.user_id,
    'مبروك! لقد فزت في المسابقة! 🎉',
    'تهانينا! لقد فزت في مسابقة: ' || comp_record.title_ar || ' - الجائزة: ' || comp_record.prize_description_ar,
    'success',
    comp_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'winner_ticket_number', winner_ticket.ticket_number,
    'winner_name', COALESCE(winner_profile.full_name, winner_profile.username)
  );
END;
$$;

-- Add updated_at trigger
CREATE TRIGGER update_competitions_updated_at
BEFORE UPDATE ON public.competitions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for competitions
ALTER PUBLICATION supabase_realtime ADD TABLE public.competitions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.competition_tickets;
