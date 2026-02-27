
-- Create wishes table
CREATE TABLE public.wishes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  image_url text,
  status text DEFAULT 'pending',
  price numeric,
  likes_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create wish_likes table
CREATE TABLE public.wish_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wish_id uuid REFERENCES public.wishes(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(wish_id, user_id)
);

-- Enable RLS
ALTER TABLE public.wishes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wish_likes ENABLE ROW LEVEL SECURITY;

-- RLS for wishes: everyone reads approved wishes
CREATE POLICY "Anyone can read approved wishes"
ON public.wishes FOR SELECT
USING (status = 'approved' OR auth.uid() = user_id);

-- Users can insert their own wishes
CREATE POLICY "Users can insert own wishes"
ON public.wishes FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own pending wishes
CREATE POLICY "Users can update own pending wishes"
ON public.wishes FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND status = 'pending')
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own wishes
CREATE POLICY "Users can delete own wishes"
ON public.wishes FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Admins can update all wishes (approve/reject/set price)
CREATE POLICY "Admins can update all wishes"
ON public.wishes FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can read all wishes
CREATE POLICY "Admins can read all wishes"
ON public.wishes FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- wish_likes: anyone can read
CREATE POLICY "Anyone can read wish likes"
ON public.wish_likes FOR SELECT
USING (true);

-- Users can insert own likes
CREATE POLICY "Users can insert own likes"
ON public.wish_likes FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can delete own likes
CREATE POLICY "Users can delete own likes"
ON public.wish_likes FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Trigger: update likes_count on wish_likes changes
CREATE OR REPLACE FUNCTION public.update_wish_likes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.wishes SET likes_count = likes_count + 1 WHERE id = NEW.wish_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.wishes SET likes_count = likes_count - 1 WHERE id = OLD.wish_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trigger_update_wish_likes_count
AFTER INSERT OR DELETE ON public.wish_likes
FOR EACH ROW
EXECUTE FUNCTION public.update_wish_likes_count();

-- Trigger: update updated_at on wishes
CREATE OR REPLACE FUNCTION public.update_wishes_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_wishes_updated_at
BEFORE UPDATE ON public.wishes
FOR EACH ROW
EXECUTE FUNCTION public.update_wishes_updated_at();
