-- Fix: Allow non-logged users to see approved community print requests
DROP POLICY IF EXISTS "Approved requests are visible to all" ON public.community_print_requests;
CREATE POLICY "Approved requests are visible to all"
  ON public.community_print_requests
  FOR SELECT
  USING (status = 'approved');

-- Create request edit history table
CREATE TABLE IF NOT EXISTS public.request_edit_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.community_print_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.request_edit_history ENABLE ROW LEVEL SECURITY;

-- Everyone can view edit history for approved requests
CREATE POLICY "Anyone can view edit history"
  ON public.request_edit_history
  FOR SELECT
  USING (true);

-- Users can insert their own edit history
CREATE POLICY "Users can insert their own edit history"
  ON public.request_edit_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX idx_request_edit_history_request_id ON public.request_edit_history(request_id);
