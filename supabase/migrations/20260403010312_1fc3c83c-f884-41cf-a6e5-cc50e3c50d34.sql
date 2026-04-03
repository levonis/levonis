
-- Table to track ad watches
CREATE TABLE public.ad_watch_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_id UUID NOT NULL,
  watch_number INT NOT NULL DEFAULT 1,
  ticket_awarded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_ad_watch_log_user ON public.ad_watch_log(user_id, created_at DESC);
CREATE INDEX idx_ad_watch_log_session ON public.ad_watch_log(session_id);

ALTER TABLE public.ad_watch_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own ad watches"
ON public.ad_watch_log FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own ad watches"
ON public.ad_watch_log FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Function to record ad watch and award ticket after 2 watches in same session
CREATE OR REPLACE FUNCTION public.record_ad_watch_and_award(
  p_user_id UUID,
  p_session_id UUID,
  p_watch_number INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_watches_in_session INT;
  v_daily_tickets_earned INT;
  v_max_daily_tickets INT := 5;
BEGIN
  -- Verify caller
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Check daily limit (max 5 tickets per day from ads)
  SELECT COUNT(*) INTO v_daily_tickets_earned
  FROM ad_watch_log
  WHERE user_id = p_user_id
    AND ticket_awarded = true
    AND created_at >= CURRENT_DATE;

  IF v_daily_tickets_earned >= v_max_daily_tickets THEN
    RETURN jsonb_build_object('success', false, 'error', 'daily_limit_reached', 'daily_earned', v_daily_tickets_earned);
  END IF;

  -- Record the watch
  INSERT INTO ad_watch_log (user_id, session_id, watch_number)
  VALUES (p_user_id, p_session_id, p_watch_number);

  -- Count watches in this session
  SELECT COUNT(*) INTO v_watches_in_session
  FROM ad_watch_log
  WHERE session_id = p_session_id AND user_id = p_user_id;

  -- If 2 watches completed, award ticket
  IF v_watches_in_session >= 2 THEN
    -- Mark as awarded
    UPDATE ad_watch_log SET ticket_awarded = true
    WHERE session_id = p_session_id AND user_id = p_user_id;

    -- Add 1 ticket
    PERFORM add_user_tickets(p_user_id, 1);

    RETURN jsonb_build_object('success', true, 'ticket_awarded', true, 'daily_earned', v_daily_tickets_earned + 1);
  END IF;

  RETURN jsonb_build_object('success', true, 'ticket_awarded', false, 'watches_done', v_watches_in_session);
END;
$$;
