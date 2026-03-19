
CREATE TABLE public.ticket_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title_ar TEXT NOT NULL,
  description_ar TEXT,
  bonus_tickets INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ticket_promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active promotions"
ON public.ticket_promotions
FOR SELECT
TO anon, authenticated
USING (is_active = true AND starts_at <= now() AND ends_at > now());

CREATE POLICY "Admins can manage promotions"
ON public.ticket_promotions
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
