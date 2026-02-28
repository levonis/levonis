
-- Admin replies to reviews
CREATE TABLE public.review_admin_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL,
  reply TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.review_admin_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view admin replies" ON public.review_admin_replies FOR SELECT USING (true);
CREATE POLICY "Admins can insert replies" ON public.review_admin_replies FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update replies" ON public.review_admin_replies FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete replies" ON public.review_admin_replies FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Review Q&A: questions asked to reviewers
CREATE TABLE public.review_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  asker_id UUID NOT NULL,
  question TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.review_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view questions" ON public.review_questions FOR SELECT USING (true);
CREATE POLICY "Authenticated users can ask questions" ON public.review_questions FOR INSERT WITH CHECK (auth.uid() = asker_id);
CREATE POLICY "Users can delete own questions" ON public.review_questions FOR DELETE USING (auth.uid() = asker_id);

-- Review Q&A: answers from reviewers
CREATE TABLE public.review_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.review_questions(id) ON DELETE CASCADE,
  answerer_id UUID NOT NULL,
  answer TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.review_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view answers" ON public.review_answers FOR SELECT USING (true);
CREATE POLICY "Authenticated users can answer" ON public.review_answers FOR INSERT WITH CHECK (auth.uid() = answerer_id);
CREATE POLICY "Users can delete own answers" ON public.review_answers FOR DELETE USING (auth.uid() = answerer_id);
