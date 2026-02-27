
DROP POLICY "Only system can insert completions" ON public.user_task_completions;

CREATE POLICY "Users can insert their own completions"
ON public.user_task_completions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
