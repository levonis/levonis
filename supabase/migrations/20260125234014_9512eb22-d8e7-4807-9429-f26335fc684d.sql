-- Fix function search path security issue
CREATE OR REPLACE FUNCTION public.get_user_card_frame(p_user_id UUID)
RETURNS TABLE(frame_url TEXT, frame_animation TEXT, card_name TEXT, card_color TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ll.frame_url,
    ll.frame_animation,
    ll.name_ar,
    ll.color
  FROM public.user_cards uc
  JOIN public.loyalty_levels ll ON ll.id = uc.level_id
  WHERE uc.user_id = p_user_id
    AND uc.is_active = true
    AND (uc.expires_at IS NULL OR uc.expires_at > NOW())
  ORDER BY ll.display_order DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;