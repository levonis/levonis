
-- Featured merchant ad slots system
CREATE TABLE public.merchant_ad_slots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  position INTEGER NOT NULL CHECK (position >= 1 AND position <= 10),
  price_per_hour NUMERIC NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed 10 positions
INSERT INTO public.merchant_ad_slots (position, price_per_hour)
SELECT generate_series(1, 10), 10;

-- Ad bookings queue
CREATE TABLE public.merchant_ad_bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  slot_position INTEGER NOT NULL CHECK (slot_position >= 1 AND slot_position <= 10),
  hours_booked INTEGER NOT NULL CHECK (hours_booked >= 1),
  total_cost NUMERIC NOT NULL,
  started_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'active', 'completed', 'cancelled')),
  cancelled_at TIMESTAMPTZ,
  refund_amount NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.merchant_ad_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_ad_bookings ENABLE ROW LEVEL SECURITY;

-- Ad slots: everyone can read, only admin can update
CREATE POLICY "Anyone can read ad slots" ON public.merchant_ad_slots FOR SELECT USING (true);

-- Ad bookings: users can read all (to see queue), own user can insert/update
CREATE POLICY "Anyone can read ad bookings" ON public.merchant_ad_bookings FOR SELECT USING (true);
CREATE POLICY "Users can create own bookings" ON public.merchant_ad_bookings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own bookings" ON public.merchant_ad_bookings FOR UPDATE USING (auth.uid() = user_id);

-- Index for active ads lookup
CREATE INDEX idx_ad_bookings_active ON public.merchant_ad_bookings (slot_position, status, expires_at);
CREATE INDEX idx_ad_bookings_merchant ON public.merchant_ad_bookings (merchant_id, status);
