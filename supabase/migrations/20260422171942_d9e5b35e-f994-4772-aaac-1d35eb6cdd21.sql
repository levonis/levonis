CREATE TABLE IF NOT EXISTS public.product_color_qa_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  color_name text NOT NULL,
  reason text,
  flagged_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, color_name)
);

CREATE INDEX IF NOT EXISTS idx_pcqa_product ON public.product_color_qa_flags(product_id);
CREATE INDEX IF NOT EXISTS idx_pcqa_resolved ON public.product_color_qa_flags(resolved);

ALTER TABLE public.product_color_qa_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage color QA flags"
  ON public.product_color_qa_flags
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.tg_pcqa_touch()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pcqa_touch ON public.product_color_qa_flags;
CREATE TRIGGER trg_pcqa_touch
  BEFORE UPDATE ON public.product_color_qa_flags
  FOR EACH ROW EXECUTE FUNCTION public.tg_pcqa_touch();