-- Drop the legacy/broken overload of end_crossy_road that takes (uuid, int, int, int).
-- This overload bypasses the points-per-step fallback (no NULLIF), causing 0 points to be awarded
-- whenever points_per_step is set to 0 in admin settings. The text-based (session_token) overload
-- is the one used by the client and contains the correct fallback logic.
DROP FUNCTION IF EXISTS public.end_crossy_road(uuid, integer, integer, integer);