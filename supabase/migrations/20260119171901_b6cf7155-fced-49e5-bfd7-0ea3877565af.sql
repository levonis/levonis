-- Add DELETE policy for users to delete their own cart requests
CREATE POLICY "Users can delete their own cart requests" 
ON public.cart_requests 
FOR DELETE 
USING (auth.uid() = user_id);