-- Create listing favorites table
CREATE TABLE public.listing_favorites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  listing_id UUID NOT NULL REFERENCES public.user_listings(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, listing_id)
);

-- Create listing likes table
CREATE TABLE public.listing_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  listing_id UUID NOT NULL REFERENCES public.user_listings(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, listing_id)
);

-- Add likes_count column to user_listings
ALTER TABLE public.user_listings ADD COLUMN likes_count INTEGER DEFAULT 0;

-- Enable RLS
ALTER TABLE public.listing_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_likes ENABLE ROW LEVEL SECURITY;

-- RLS policies for listing_favorites
CREATE POLICY "Users can view their own favorites" 
ON public.listing_favorites 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can add favorites" 
ON public.listing_favorites 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove favorites" 
ON public.listing_favorites 
FOR DELETE 
USING (auth.uid() = user_id);

-- RLS policies for listing_likes
CREATE POLICY "Anyone can view likes count" 
ON public.listing_likes 
FOR SELECT 
USING (true);

CREATE POLICY "Users can add likes" 
ON public.listing_likes 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove likes" 
ON public.listing_likes 
FOR DELETE 
USING (auth.uid() = user_id);

-- Function to update likes count
CREATE OR REPLACE FUNCTION public.update_listing_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.user_listings SET likes_count = likes_count + 1 WHERE id = NEW.listing_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.user_listings SET likes_count = GREATEST(0, likes_count - 1) WHERE id = OLD.listing_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for likes count
CREATE TRIGGER update_likes_count_trigger
AFTER INSERT OR DELETE ON public.listing_likes
FOR EACH ROW
EXECUTE FUNCTION public.update_listing_likes_count();