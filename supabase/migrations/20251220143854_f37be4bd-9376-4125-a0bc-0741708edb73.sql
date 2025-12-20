-- Add RESTRICTIVE baseline policies for all sensitive tables
-- Using FOR ALL with both USING and WITH CHECK for full coverage

-- user_wallets - Financial data
CREATE POLICY "Require authentication for wallet access"
ON public.user_wallets
AS RESTRICTIVE
FOR ALL
TO public
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- wallet_transactions - Financial transactions
CREATE POLICY "Require authentication for wallet transactions"
ON public.wallet_transactions
AS RESTRICTIVE
FOR ALL
TO public
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- user_addresses - Physical addresses
CREATE POLICY "Require authentication for address access"
ON public.user_addresses
AS RESTRICTIVE
FOR ALL
TO public
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- user_points - Loyalty points
CREATE POLICY "Require authentication for points access"
ON public.user_points
AS RESTRICTIVE
FOR ALL
TO public
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- points_transactions - Points history
CREATE POLICY "Require authentication for points transactions"
ON public.points_transactions
AS RESTRICTIVE
FOR ALL
TO public
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- cart_items - Shopping cart
CREATE POLICY "Require authentication for cart access"
ON public.cart_items
AS RESTRICTIVE
FOR ALL
TO public
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- order_items - Order details
CREATE POLICY "Require authentication for order items"
ON public.order_items
AS RESTRICTIVE
FOR ALL
TO public
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- custom_product_requests - Custom requests
CREATE POLICY "Require authentication for custom requests"
ON public.custom_product_requests
AS RESTRICTIVE
FOR ALL
TO public
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- favorites - User favorites
CREATE POLICY "Require authentication for favorites"
ON public.favorites
AS RESTRICTIVE
FOR ALL
TO public
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- notifications - User notifications
CREATE POLICY "Require authentication for notifications"
ON public.notifications
AS RESTRICTIVE
FOR ALL
TO public
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- messages - Chat messages
CREATE POLICY "Require authentication for messages"
ON public.messages
AS RESTRICTIVE
FOR ALL
TO public
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- conversations - Chat conversations
CREATE POLICY "Require authentication for conversations"
ON public.conversations
AS RESTRICTIVE
FOR ALL
TO public
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- competition_tickets - Competition entries
CREATE POLICY "Require authentication for competition tickets"
ON public.competition_tickets
AS RESTRICTIVE
FOR ALL
TO public
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- user_tickets - User ticket balance
CREATE POLICY "Require authentication for user tickets"
ON public.user_tickets
AS RESTRICTIVE
FOR ALL
TO public
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- user_referrals - Referral data
CREATE POLICY "Require authentication for referrals"
ON public.user_referrals
AS RESTRICTIVE
FOR ALL
TO public
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- user_task_completions - Task completion data
CREATE POLICY "Require authentication for task completions"
ON public.user_task_completions
AS RESTRICTIVE
FOR ALL
TO public
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- coupon_usage - Coupon usage history
CREATE POLICY "Require authentication for coupon usage"
ON public.coupon_usage
AS RESTRICTIVE
FOR ALL
TO public
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- saved_invoices - Invoice data
CREATE POLICY "Require authentication for saved invoices"
ON public.saved_invoices
AS RESTRICTIVE
FOR ALL
TO public
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- reviews - User reviews (FOR ALL covers insert, update, delete, select)
CREATE POLICY "Require authentication for reviews"
ON public.reviews
AS RESTRICTIVE
FOR ALL
TO public
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- gig_applications - Freelancer applications
CREATE POLICY "Require authentication for gig applications"
ON public.gig_applications
AS RESTRICTIVE
FOR ALL
TO public
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- gigs - Job postings
CREATE POLICY "Require authentication for gigs"
ON public.gigs
AS RESTRICTIVE
FOR ALL
TO public
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);