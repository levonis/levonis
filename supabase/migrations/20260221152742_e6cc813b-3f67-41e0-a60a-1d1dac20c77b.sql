-- Create queue/preorder bookings table
CREATE TABLE IF NOT EXISTS public.product_bookings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.merchant_products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  merchant_id uuid NOT NULL,
  booking_type text NOT NULL DEFAULT 'waitlist',
  queue_position int,
  deposit_amount numeric DEFAULT 0,
  deposit_paid boolean DEFAULT false,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bookings"
  ON public.product_bookings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create bookings"
  ON public.product_bookings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bookings"
  ON public.product_bookings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Merchants can view product bookings"
  ON public.product_bookings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM merchant_applications ma
      WHERE ma.user_id = auth.uid()
      AND ma.id = product_bookings.merchant_id
      AND ma.status = 'approved'
    )
  );

CREATE POLICY "Merchants can update product bookings"
  ON public.product_bookings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM merchant_applications ma
      WHERE ma.user_id = auth.uid()
      AND ma.id = product_bookings.merchant_id
      AND ma.status = 'approved'
    )
  );