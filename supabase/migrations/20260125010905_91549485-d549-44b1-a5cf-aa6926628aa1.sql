-- Avatar frames system for merchants
CREATE TABLE public.avatar_frames (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name_ar TEXT NOT NULL,
  image_url TEXT NOT NULL,
  is_free BOOLEAN NOT NULL DEFAULT false,
  points_cost INTEGER DEFAULT 0,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User owned frames
CREATE TABLE public.user_avatar_frames (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  frame_id UUID NOT NULL REFERENCES public.avatar_frames(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT false,
  purchased_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, frame_id)
);

-- Enable RLS
ALTER TABLE public.avatar_frames ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_avatar_frames ENABLE ROW LEVEL SECURITY;

-- Avatar frames: everyone can read active frames
CREATE POLICY "Anyone can view active frames" 
ON public.avatar_frames 
FOR SELECT 
USING (is_active = true);

-- User avatar frames policies
CREATE POLICY "Users can view their own frames" 
ON public.user_avatar_frames 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own frames" 
ON public.user_avatar_frames 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own frames" 
ON public.user_avatar_frames 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Add selected_frame_id to merchant_applications
ALTER TABLE public.merchant_applications 
ADD COLUMN IF NOT EXISTS selected_frame_id UUID REFERENCES public.avatar_frames(id);

-- Insert default free frames
INSERT INTO public.avatar_frames (name_ar, image_url, is_free, points_cost, display_order) VALUES
('بدون إطار', '', true, 0, 0),
('إطار ذهبي بسيط', '/frames/gold-simple.svg', true, 0, 1),
('إطار فضي', '/frames/silver.svg', true, 0, 2),
('إطار نجمة', '/frames/star.svg', false, 500, 3),
('إطار ماسي', '/frames/diamond.svg', false, 1000, 4),
('إطار ملكي', '/frames/royal.svg', false, 2000, 5);