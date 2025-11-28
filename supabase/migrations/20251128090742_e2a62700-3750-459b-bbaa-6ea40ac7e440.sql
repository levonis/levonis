-- Create gigs table for managers to post
CREATE TABLE public.gigs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  manager_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  description TEXT,
  description_ar TEXT,
  budget_min NUMERIC,
  budget_max NUMERIC,
  currency TEXT DEFAULT 'دينار عراقي',
  category TEXT,
  skills_required TEXT[],
  deadline TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create gig applications table for workers
CREATE TABLE public.gig_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gig_id UUID NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cover_letter TEXT,
  proposed_budget NUMERIC,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(gig_id, worker_id)
);

-- Enable RLS
ALTER TABLE public.gigs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gig_applications ENABLE ROW LEVEL SECURITY;

-- Gigs policies
CREATE POLICY "Anyone can view open gigs" 
ON public.gigs 
FOR SELECT 
USING (status = 'open' OR manager_id = auth.uid());

CREATE POLICY "Managers can create gigs" 
ON public.gigs 
FOR INSERT 
WITH CHECK (
  auth.uid() = manager_id AND 
  (has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Managers can update their own gigs" 
ON public.gigs 
FOR UPDATE 
USING (auth.uid() = manager_id);

CREATE POLICY "Managers can delete their own gigs" 
ON public.gigs 
FOR DELETE 
USING (auth.uid() = manager_id);

-- Gig applications policies
CREATE POLICY "Workers can view their own applications" 
ON public.gig_applications 
FOR SELECT 
USING (auth.uid() = worker_id);

CREATE POLICY "Managers can view applications for their gigs" 
ON public.gig_applications 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.gigs 
    WHERE gigs.id = gig_applications.gig_id 
    AND gigs.manager_id = auth.uid()
  )
);

CREATE POLICY "Workers can apply to gigs" 
ON public.gig_applications 
FOR INSERT 
WITH CHECK (
  auth.uid() = worker_id AND 
  (has_role(auth.uid(), 'worker') OR has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Workers can update their own applications" 
ON public.gig_applications 
FOR UPDATE 
USING (auth.uid() = worker_id);

CREATE POLICY "Managers can update applications status" 
ON public.gig_applications 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.gigs 
    WHERE gigs.id = gig_applications.gig_id 
    AND gigs.manager_id = auth.uid()
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_gigs_updated_at
BEFORE UPDATE ON public.gigs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_gig_applications_updated_at
BEFORE UPDATE ON public.gig_applications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();