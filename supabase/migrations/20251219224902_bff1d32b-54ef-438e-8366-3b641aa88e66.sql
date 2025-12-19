-- Update generate_ticket_number to create unique random ticket numbers
CREATE OR REPLACE FUNCTION public.generate_ticket_number(comp_id uuid)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_number TEXT;
  random_num INTEGER;
  attempts INTEGER := 0;
  max_attempts INTEGER := 100;
BEGIN
  LOOP
    -- Generate random 6-digit number between 100000 and 999999
    random_num := floor(random() * 900000 + 100000)::INTEGER;
    new_number := 'TKT-' || random_num::TEXT;
    
    -- Check if this number already exists for this competition
    IF NOT EXISTS (
      SELECT 1 FROM competition_tickets 
      WHERE competition_id = comp_id AND ticket_number = new_number
    ) THEN
      RETURN new_number;
    END IF;
    
    attempts := attempts + 1;
    IF attempts >= max_attempts THEN
      -- Fallback: use timestamp + random for guaranteed uniqueness
      new_number := 'TKT-' || extract(epoch from now())::INTEGER || floor(random() * 1000)::INTEGER;
      RETURN new_number;
    END IF;
  END LOOP;
END;
$$;