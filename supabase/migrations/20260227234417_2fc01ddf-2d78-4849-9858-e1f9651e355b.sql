
CREATE TABLE IF NOT EXISTS public.pending_task_approvals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  task_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  proof_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID
);

ALTER TABLE public.pending_task_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own approvals" ON public.pending_task_approvals;
DROP POLICY IF EXISTS "Users can request approval" ON public.pending_task_approvals;
DROP POLICY IF EXISTS "Admin can view all approvals" ON public.pending_task_approvals;
DROP POLICY IF EXISTS "Admin can update approvals" ON public.pending_task_approvals;

CREATE POLICY "Users can view own approvals" ON public.pending_task_approvals
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can request approval" ON public.pending_task_approvals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin can view all approvals" ON public.pending_task_approvals
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admin can update approvals" ON public.pending_task_approvals
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
