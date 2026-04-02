
CREATE TABLE public.product_batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name_ar TEXT NOT NULL,
  batch_quantity INTEGER NOT NULL DEFAULT 0,
  batch_cost NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.product_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view batches"
  ON public.product_batches FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create batches"
  ON public.product_batches FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update batches"
  ON public.product_batches FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete batches"
  ON public.product_batches FOR DELETE
  TO authenticated
  USING (true);
