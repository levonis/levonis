
-- Add gift columns to cart_items
ALTER TABLE public.cart_items ADD COLUMN IF NOT EXISTS is_gift boolean NOT NULL DEFAULT false;
ALTER TABLE public.cart_items ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false;

-- Create RPC to claim a stack game milestone prize and add it to cart
CREATE OR REPLACE FUNCTION public.claim_stack_prize_to_cart(p_milestone_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_milestone record;
  v_user_id uuid := auth.uid();
  v_existing_gift record;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- Get milestone with product info
  SELECT * INTO v_milestone
  FROM stack_game_milestones
  WHERE id = p_milestone_id AND is_active = true;

  IF v_milestone IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'milestone_not_found');
  END IF;

  IF v_milestone.product_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_product_configured');
  END IF;

  -- Check if user already has this gift in cart
  SELECT * INTO v_existing_gift
  FROM cart_items
  WHERE user_id = v_user_id
    AND product_id = v_milestone.product_id
    AND is_gift = true;

  IF v_existing_gift IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'already_in_cart', true);
  END IF;

  -- Insert gift into cart
  INSERT INTO cart_items (
    user_id,
    product_id,
    product_option_id,
    selected_color,
    quantity,
    sale_type,
    is_gift,
    is_locked
  ) VALUES (
    v_user_id,
    v_milestone.product_id,
    v_milestone.selected_option_id,
    v_milestone.selected_color,
    1,
    'direct',
    true,
    true
  );

  RETURN jsonb_build_object('success', true, 'added', true);
END;
$$;
