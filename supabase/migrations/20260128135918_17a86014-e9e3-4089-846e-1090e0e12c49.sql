-- Add material fields to print_offers table
ALTER TABLE public.print_offers 
ADD COLUMN IF NOT EXISTS material_type text,
ADD COLUMN IF NOT EXISTS material_subtypes text[];

-- Create printer models table for merchants
CREATE TABLE IF NOT EXISTS public.merchant_printer_models (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id uuid NOT NULL REFERENCES public.merchant_applications(id) ON DELETE CASCADE,
  model_name text NOT NULL,
  brand text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS for printer models
ALTER TABLE public.merchant_printer_models ENABLE ROW LEVEL SECURITY;

-- Policies for printer models
CREATE POLICY "Everyone can view printer models"
  ON public.merchant_printer_models FOR SELECT
  USING (true);

CREATE POLICY "Merchants can manage their own printer models"
  ON public.merchant_printer_models FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.merchant_applications ma
      WHERE ma.id = merchant_id AND ma.user_id = auth.uid()
    )
  );

-- Create store followers table
CREATE TABLE IF NOT EXISTS public.store_followers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES public.merchant_applications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(store_id, user_id)
);

-- Enable RLS for store followers
ALTER TABLE public.store_followers ENABLE ROW LEVEL SECURITY;

-- Policies for store followers
CREATE POLICY "Everyone can view follower counts"
  ON public.store_followers FOR SELECT
  USING (true);

CREATE POLICY "Users can follow/unfollow stores"
  ON public.store_followers FOR ALL
  USING (auth.uid() = user_id);

-- Create likes table for products and requests
CREATE TABLE IF NOT EXISTS public.community_likes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('product', 'request')),
  target_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, target_type, target_id)
);

-- Enable RLS for likes
ALTER TABLE public.community_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view likes"
  ON public.community_likes FOR SELECT
  USING (true);

CREATE POLICY "Users can manage their own likes"
  ON public.community_likes FOR ALL
  USING (auth.uid() = user_id);

-- Create comments table for products and requests
CREATE TABLE IF NOT EXISTS public.community_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('product', 'request')),
  target_id uuid NOT NULL,
  content text NOT NULL,
  parent_id uuid REFERENCES public.community_comments(id) ON DELETE CASCADE,
  is_hidden boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS for comments
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view visible comments"
  ON public.community_comments FOR SELECT
  USING (is_hidden = false);

CREATE POLICY "Users can create comments"
  ON public.community_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments"
  ON public.community_comments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
  ON public.community_comments FOR DELETE
  USING (auth.uid() = user_id);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_printer_models_merchant ON public.merchant_printer_models(merchant_id);
CREATE INDEX IF NOT EXISTS idx_store_followers_store ON public.store_followers(store_id);
CREATE INDEX IF NOT EXISTS idx_store_followers_user ON public.store_followers(user_id);
CREATE INDEX IF NOT EXISTS idx_community_likes_target ON public.community_likes(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_community_comments_target ON public.community_comments(target_type, target_id);