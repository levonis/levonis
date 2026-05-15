CREATE OR REPLACE FUNCTION public.get_recent_donors(p_limit integer DEFAULT 50)
RETURNS TABLE (
  user_id uuid,
  display_name text,
  total_amount numeric,
  donation_count bigint,
  last_donation_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    d.user_id,
    MAX(d.display_name) as display_name,
    SUM(d.amount) as total_amount,
    COUNT(*) as donation_count,
    MAX(d.created_at) as last_donation_at
  FROM public.donations_log d
  GROUP BY d.user_id
  ORDER BY MAX(d.created_at) DESC
  LIMIT p_limit;
$$;