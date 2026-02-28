
-- Context table for review Q&A telegram replies
CREATE TABLE public.review_telegram_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_chat_id TEXT NOT NULL UNIQUE,
  question_id UUID NOT NULL REFERENCES public.review_questions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.review_telegram_context ENABLE ROW LEVEL SECURITY;

-- Only service role needs access
CREATE POLICY "Service only" ON public.review_telegram_context FOR ALL USING (false);
