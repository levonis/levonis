-- Allow admin to delete printer_protection_logs
CREATE POLICY "Admins can delete printer_protection_logs"
ON public.printer_protection_logs
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
);

-- Create maintenance_technicians table for technician accounts
CREATE TABLE IF NOT EXISTS public.maintenance_technicians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  name_ar TEXT NOT NULL,
  phone TEXT,
  specialization TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.maintenance_technicians ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage technicians"
ON public.maintenance_technicians
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Technicians can read own record"
ON public.maintenance_technicians
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Add conversation_type to conversations for maintenance chats
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS conversation_type TEXT NOT NULL DEFAULT 'support',
ADD COLUMN IF NOT EXISTS technician_id UUID REFERENCES public.maintenance_technicians(id);

-- Add maintenance chat type support
COMMENT ON COLUMN public.conversations.conversation_type IS 'support or maintenance';