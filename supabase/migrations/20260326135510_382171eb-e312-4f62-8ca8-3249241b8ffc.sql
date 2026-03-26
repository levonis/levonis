
CREATE TABLE public.purchase_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  status TEXT DEFAULT 'draft',
  items JSONB DEFAULT '[]'::jsonb,
  total_value NUMERIC DEFAULT 0,
  notes TEXT,
  converted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.purchase_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage purchase_drafts" ON public.purchase_drafts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.future_shipments 
  ADD COLUMN IF NOT EXISTS draft_id UUID REFERENCES public.purchase_drafts(id),
  ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;
