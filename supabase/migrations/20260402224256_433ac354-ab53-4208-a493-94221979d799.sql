
-- Drop the old unique constraint that prevents same user from claiming same milestone twice
ALTER TABLE public.stack_game_milestone_claims 
DROP CONSTRAINT stack_game_milestone_claims_milestone_id_user_id_key;

-- Add new unique constraint that allows per-session claims
CREATE UNIQUE INDEX stack_game_milestone_claims_milestone_user_session_key 
ON public.stack_game_milestone_claims (milestone_id, user_id, COALESCE(session_id, '00000000-0000-0000-0000-000000000000'::uuid));
