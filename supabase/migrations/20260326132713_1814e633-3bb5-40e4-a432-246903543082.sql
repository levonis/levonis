
CREATE TABLE public.future_shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  quantity INTEGER NOT NULL,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  unit_cost NUMERIC GENERATED ALWAYS AS (CASE WHEN quantity > 0 THEN total_cost / quantity ELSE 0 END) STORED,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  merged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.future_shipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on future_shipments"
  ON public.future_shipments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
