
-- Create game_prizes table for unified prize tracking across all games
CREATE TABLE IF NOT EXISTS public.game_prizes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  game_name TEXT NOT NULL,
  prize_name_ar TEXT NOT NULL,
  prize_type TEXT NOT NULL DEFAULT 'milestone',
  prize_image_url TEXT,
  product_id UUID,
  score_achieved INTEGER,
  how_won_ar TEXT,
  is_delivered BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.game_prizes ENABLE ROW LEVEL SECURITY;

-- Users can view their own prizes
CREATE POLICY "Users can view own game prizes"
ON public.game_prizes FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins can view all prizes
CREATE POLICY "Admins can view all game prizes"
ON public.game_prizes FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update prizes (mark as delivered)
CREATE POLICY "Admins can update game prizes"
ON public.game_prizes FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow insert from RPCs (service role or authenticated via RPC)
CREATE POLICY "System can insert game prizes"
ON public.game_prizes FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Now recreate check_stack_milestone to handle the game_prizes insert properly
CREATE OR REPLACE FUNCTION public.check_stack_milestone(p_score integer, p_session_id text, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_milestone stack_game_milestones%ROWTYPE;
  v_already_claimed boolean;
  v_result jsonb := '{"won": false}'::jsonb;
  v_product_name text;
  v_product_image text;
BEGIN
  -- Find highest qualifying milestone not yet fully claimed
  SELECT * INTO v_milestone
  FROM stack_game_milestones
  WHERE is_active = true AND p_score >= target_score AND claimed_count < stock
  ORDER BY target_score DESC
  LIMIT 1;

  IF v_milestone.id IS NULL THEN
    RETURN v_result;
  END IF;

  -- Check if user already claimed this milestone
  SELECT EXISTS(SELECT 1 FROM stack_game_milestone_claims WHERE milestone_id = v_milestone.id AND user_id = p_user_id)
  INTO v_already_claimed;

  IF v_already_claimed THEN
    RETURN v_result;
  END IF;

  -- Handle product stock
  IF v_milestone.product_id IS NOT NULL THEN
    IF NOT deduct_prize_stock(v_milestone.product_id) THEN
      RETURN '{"won": false, "reason": "product_out_of_stock"}'::jsonb;
    END IF;

    SELECT name_ar, image_url INTO v_product_name, v_product_image
    FROM products WHERE id = v_milestone.product_id;
  END IF;

  -- Record the claim
  INSERT INTO stack_game_milestone_claims (milestone_id, user_id, session_id, score_achieved)
  VALUES (v_milestone.id, p_user_id, p_session_id, p_score);

  -- Update milestone claimed count
  UPDATE stack_game_milestones SET claimed_count = claimed_count + 1, updated_at = now()
  WHERE id = v_milestone.id;

  -- Record winner
  INSERT INTO stack_game_winners (user_id, prize_name_ar, prize_type, score, product_id)
  VALUES (p_user_id, COALESCE(v_product_name, v_milestone.prize_name_ar), 'milestone', p_score, v_milestone.product_id);

  -- Insert into unified game_prizes table
  INSERT INTO game_prizes (user_id, game_name, prize_name_ar, prize_type, prize_image_url, product_id, score_achieved, how_won_ar)
  VALUES (p_user_id, 'البرج', COALESCE(v_product_name, v_milestone.prize_name_ar), 'milestone', COALESCE(v_product_image, v_milestone.prize_image_url), v_milestone.product_id, p_score, 'هدف مرحلي - سكور ' || p_score);

  v_result := jsonb_build_object(
    'won', true,
    'milestone_id', v_milestone.id,
    'prize_name', COALESCE(v_product_name, v_milestone.prize_name_ar),
    'prize_image', COALESCE(v_product_image, v_milestone.prize_image_url),
    'stock_remaining', v_milestone.stock - v_milestone.claimed_count - 1
  );

  RETURN v_result;
END;
$$;
