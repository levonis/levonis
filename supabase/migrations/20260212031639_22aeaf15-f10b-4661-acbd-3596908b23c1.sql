
-- Create merchant rating replies table
CREATE TABLE public.merchant_rating_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rating_id UUID NOT NULL REFERENCES public.merchant_ratings(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL,
  reply_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique constraint: one reply per rating
ALTER TABLE public.merchant_rating_replies ADD CONSTRAINT unique_reply_per_rating UNIQUE (rating_id);

-- Enable RLS
ALTER TABLE public.merchant_rating_replies ENABLE ROW LEVEL SECURITY;

-- Everyone can read replies
CREATE POLICY "Anyone can view rating replies"
ON public.merchant_rating_replies FOR SELECT
USING (true);

-- Merchants can insert replies to their own ratings
CREATE POLICY "Merchants can reply to their ratings"
ON public.merchant_rating_replies FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.merchant_applications ma
    WHERE ma.id = merchant_id AND ma.user_id = auth.uid()
  )
);

-- Merchants can update their own replies
CREATE POLICY "Merchants can update their replies"
ON public.merchant_rating_replies FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.merchant_applications ma
    WHERE ma.id = merchant_id AND ma.user_id = auth.uid()
  )
);

-- Merchants can delete their own replies
CREATE POLICY "Merchants can delete their replies"
ON public.merchant_rating_replies FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.merchant_applications ma
    WHERE ma.id = merchant_id AND ma.user_id = auth.uid()
  )
);
