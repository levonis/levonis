-- Auto-approve reviews: no admin moderation required
ALTER TABLE public.reviews ALTER COLUMN status SET DEFAULT 'approved';

-- Approve all currently pending reviews so they become publicly visible immediately
UPDATE public.reviews SET status = 'approved' WHERE status = 'pending';