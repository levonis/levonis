-- Add loyalty level frame column to link frames with cards
ALTER TABLE public.loyalty_levels 
ADD COLUMN IF NOT EXISTS frame_url TEXT,
ADD COLUMN IF NOT EXISTS frame_animation TEXT DEFAULT 'pulse';

-- Add customer frame column to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS selected_frame_id UUID REFERENCES public.avatar_frames(id),
ADD COLUMN IF NOT EXISTS active_card_frame_url TEXT;

-- Update loyalty levels with their exclusive frames
UPDATE public.loyalty_levels SET 
  frame_url = '/frames/levo-bronze.svg',
  frame_animation = 'pulse'
WHERE level_key = 'bronze';

UPDATE public.loyalty_levels SET 
  frame_url = '/frames/levo-classic.svg', 
  frame_animation = 'shimmer'
WHERE level_key = 'silver';

UPDATE public.loyalty_levels SET 
  frame_url = '/frames/levo-pro.svg',
  frame_animation = 'glow'
WHERE level_key = 'gold';

UPDATE public.loyalty_levels SET 
  frame_url = '/frames/levo-vip.svg',
  frame_animation = 'rainbow'
WHERE level_key = 'platinum';

-- Create function to get user's active card frame
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access
GRANT EXECUTE ON FUNCTION public.get_user_card_frame TO authenticated, anon;