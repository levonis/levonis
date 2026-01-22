-- Print-on-demand marketplace (MVP): print requests + offers + file attachments (lazy download)

-- 1) Enums
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'print_request_status') THEN
    CREATE TYPE public.print_request_status AS ENUM ('pending_review','approved','rejected');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'print_offer_status') THEN
    CREATE TYPE public.print_offer_status AS ENUM ('submitted','withdrawn','accepted','rejected');
  END IF;
END $$;

-- 2) Core tables
CREATE TABLE IF NOT EXISTS public.print_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  notes TEXT,
  size_spec TEXT,
  colors_spec TEXT,
  reference_links TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  status public.print_request_status NOT NULL DEFAULT 'pending_review',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_print_requests_user_id ON public.print_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_print_requests_status ON public.print_requests(status);

CREATE TABLE IF NOT EXISTS public.print_request_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.print_requests(id) ON DELETE CASCADE,
  uploader_id UUID NOT NULL,
  bucket_id TEXT NOT NULL DEFAULT 'print-files',
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  file_size_bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_print_request_attachments_request_id ON public.print_request_attachments(request_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_print_request_attachments_path ON public.print_request_attachments(bucket_id, storage_path);

CREATE TABLE IF NOT EXISTS public.print_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.print_requests(id) ON DELETE CASCADE,
  trader_id UUID NOT NULL,
  price_iqd INTEGER NOT NULL,
  duration_days INTEGER NOT NULL,
  grams INTEGER,
  notes TEXT,
  status public.print_offer_status NOT NULL DEFAULT 'submitted',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_print_offers_request_id ON public.print_offers(request_id);
CREATE INDEX IF NOT EXISTS idx_print_offers_trader_id ON public.print_offers(trader_id);
CREATE INDEX IF NOT EXISTS idx_print_offers_status ON public.print_offers(status);

-- 3) updated_at triggers
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_print_requests_updated_at'
  ) THEN
    CREATE TRIGGER update_print_requests_updated_at
    BEFORE UPDATE ON public.print_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_print_offers_updated_at'
  ) THEN
    CREATE TRIGGER update_print_offers_updated_at
    BEFORE UPDATE ON public.print_offers
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- 4) RLS
ALTER TABLE public.print_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_request_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_offers ENABLE ROW LEVEL SECURITY;

-- print_requests policies
DROP POLICY IF EXISTS "Users can create their print requests" ON public.print_requests;
CREATE POLICY "Users can create their print requests"
ON public.print_requests
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own print requests" ON public.print_requests;
CREATE POLICY "Users can view their own print requests"
ON public.print_requests
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone authenticated can view approved print requests" ON public.print_requests;
CREATE POLICY "Anyone authenticated can view approved print requests"
ON public.print_requests
FOR SELECT
TO authenticated
USING (status = 'approved');

DROP POLICY IF EXISTS "Users can update their pending print requests" ON public.print_requests;
CREATE POLICY "Users can update their pending print requests"
ON public.print_requests
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND status = 'pending_review')
WITH CHECK (auth.uid() = user_id AND status = 'pending_review');

-- Admin review (requires existing has_role function + app_role enum)
DROP POLICY IF EXISTS "Admins can review print requests" ON public.print_requests;
CREATE POLICY "Admins can review print requests"
ON public.print_requests
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- attachments policies
DROP POLICY IF EXISTS "Users can add attachments to their print requests" ON public.print_request_attachments;
CREATE POLICY "Users can add attachments to their print requests"
ON public.print_request_attachments
FOR INSERT
TO authenticated
WITH CHECK (
  uploader_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.print_requests r
    WHERE r.id = request_id
      AND r.user_id = auth.uid()
      AND r.status = 'pending_review'
  )
);

DROP POLICY IF EXISTS "Users can view attachments for their own print requests" ON public.print_request_attachments;
CREATE POLICY "Users can view attachments for their own print requests"
ON public.print_request_attachments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.print_requests r
    WHERE r.id = request_id
      AND r.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Anyone authenticated can view attachments for approved print requests" ON public.print_request_attachments;
CREATE POLICY "Anyone authenticated can view attachments for approved print requests"
ON public.print_request_attachments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.print_requests r
    WHERE r.id = request_id
      AND r.status = 'approved'
  )
);

DROP POLICY IF EXISTS "Admins can manage all print attachments" ON public.print_request_attachments;
CREATE POLICY "Admins can manage all print attachments"
ON public.print_request_attachments
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- offers policies
DROP POLICY IF EXISTS "Anyone authenticated can create offers on approved requests" ON public.print_offers;
CREATE POLICY "Anyone authenticated can create offers on approved requests"
ON public.print_offers
FOR INSERT
TO authenticated
WITH CHECK (
  trader_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.print_requests r
    WHERE r.id = request_id
      AND r.status = 'approved'
  )
);

DROP POLICY IF EXISTS "Users can view offers for approved requests" ON public.print_offers;
CREATE POLICY "Users can view offers for approved requests"
ON public.print_offers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.print_requests r
    WHERE r.id = request_id
      AND (r.status = 'approved' OR r.user_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "Trader can update their offers" ON public.print_offers;
CREATE POLICY "Trader can update their offers"
ON public.print_offers
FOR UPDATE
TO authenticated
USING (trader_id = auth.uid())
WITH CHECK (trader_id = auth.uid());

DROP POLICY IF EXISTS "Request owner can accept/reject offers" ON public.print_offers;
CREATE POLICY "Request owner can accept/reject offers"
ON public.print_offers
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.print_requests r
    WHERE r.id = request_id
      AND r.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.print_requests r
    WHERE r.id = request_id
      AND r.user_id = auth.uid()
  )
);

-- 5) Storage bucket for STL/OBJ (private) with 20MB limit
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'print-files',
  'print-files',
  false,
  20971520,
  ARRAY[
    'application/octet-stream',
    'model/stl',
    'model/obj',
    'application/sla',
    'text/plain'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Helper: allow storage policy to reference print request approval safely
CREATE OR REPLACE FUNCTION public.can_read_print_file(object_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.print_request_attachments a
    JOIN public.print_requests r ON r.id = a.request_id
    WHERE a.bucket_id = 'print-files'
      AND a.storage_path = object_name
      AND (
        r.user_id = auth.uid()
        OR r.status = 'approved'
        OR public.has_role(auth.uid(), 'admin')
      )
  );
$$;

-- Storage RLS policies (bucket private)
DROP POLICY IF EXISTS "Users can upload print files" ON storage.objects;
CREATE POLICY "Users can upload print files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'print-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can read print files after approval" ON storage.objects;
CREATE POLICY "Users can read print files after approval"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'print-files'
  AND public.can_read_print_file(name)
);

DROP POLICY IF EXISTS "Users can delete their own print files" ON storage.objects;
CREATE POLICY "Users can delete their own print files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'print-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
