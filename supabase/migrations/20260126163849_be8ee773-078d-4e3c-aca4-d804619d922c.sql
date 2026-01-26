-- Create community print requests table
CREATE TABLE public.community_print_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  size TEXT NOT NULL,
  colors TEXT NOT NULL,
  notes TEXT,
  image_url TEXT NOT NULL,
  reference_links TEXT[],
  status TEXT NOT NULL DEFAULT 'pending_review',
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.community_print_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests
CREATE POLICY "Users can view their own print requests"
ON public.community_print_requests
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own requests
CREATE POLICY "Users can create their own print requests"
ON public.community_print_requests
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own pending requests
CREATE POLICY "Users can update their own pending requests"
ON public.community_print_requests
FOR UPDATE
USING (auth.uid() = user_id AND status IN ('pending_review', 'rejected'));

-- Users can delete their own pending requests
CREATE POLICY "Users can delete their own pending requests"
ON public.community_print_requests
FOR DELETE
USING (auth.uid() = user_id AND status IN ('pending_review', 'rejected'));

-- Approved requests are visible to all authenticated users (merchants can see them)
CREATE POLICY "Approved requests are visible to all"
ON public.community_print_requests
FOR SELECT
USING (status = 'approved' AND auth.uid() IS NOT NULL);

-- Add index for status filtering
CREATE INDEX idx_community_print_requests_status ON public.community_print_requests(status);
CREATE INDEX idx_community_print_requests_user_id ON public.community_print_requests(user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_community_print_requests_updated_at
BEFORE UPDATE ON public.community_print_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();