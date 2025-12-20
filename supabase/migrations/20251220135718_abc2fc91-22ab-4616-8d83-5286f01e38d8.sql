-- Fix all remaining RLS policies to use TO authenticated

-- ===================== cart_items =====================
DROP POLICY IF EXISTS "Users can view their own cart items" ON public.cart_items;
DROP POLICY IF EXISTS "Users can insert their own cart items" ON public.cart_items;
DROP POLICY IF EXISTS "Users can update their own cart items" ON public.cart_items;
DROP POLICY IF EXISTS "Users can delete their own cart items" ON public.cart_items;

CREATE POLICY "Users can view their own cart items" ON public.cart_items FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own cart items" ON public.cart_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own cart items" ON public.cart_items FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own cart items" ON public.cart_items FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ===================== conversations =====================
DROP POLICY IF EXISTS "Users can view their own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can create their own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Admins can view all conversations" ON public.conversations;
DROP POLICY IF EXISTS "Admins can update conversations" ON public.conversations;

CREATE POLICY "Users can view their own conversations" ON public.conversations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own conversations" ON public.conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all conversations" ON public.conversations FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update conversations" ON public.conversations FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ===================== coupon_usage =====================
DROP POLICY IF EXISTS "Users can view their own coupon usage" ON public.coupon_usage;
DROP POLICY IF EXISTS "Users can insert their own coupon usage" ON public.coupon_usage;
DROP POLICY IF EXISTS "Admins can view all coupon usage" ON public.coupon_usage;

CREATE POLICY "Users can view their own coupon usage" ON public.coupon_usage FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own coupon usage" ON public.coupon_usage FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all coupon usage" ON public.coupon_usage FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ===================== custom_product_requests =====================
DROP POLICY IF EXISTS "Users can view their own custom requests" ON public.custom_product_requests;
DROP POLICY IF EXISTS "Users can create custom requests" ON public.custom_product_requests;
DROP POLICY IF EXISTS "Admins can view all custom requests" ON public.custom_product_requests;
DROP POLICY IF EXISTS "Admins can update custom requests" ON public.custom_product_requests;

CREATE POLICY "Users can view their own custom requests" ON public.custom_product_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create custom requests" ON public.custom_product_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all custom requests" ON public.custom_product_requests FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update custom requests" ON public.custom_product_requests FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ===================== favorites =====================
DROP POLICY IF EXISTS "Users can view their own favorites" ON public.favorites;
DROP POLICY IF EXISTS "Users can add to their favorites" ON public.favorites;
DROP POLICY IF EXISTS "Users can remove from their favorites" ON public.favorites;

CREATE POLICY "Users can view their own favorites" ON public.favorites FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can add to their favorites" ON public.favorites FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove from their favorites" ON public.favorites FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ===================== gig_applications =====================
DROP POLICY IF EXISTS "Workers can view their own applications" ON public.gig_applications;
DROP POLICY IF EXISTS "Workers can apply to gigs" ON public.gig_applications;
DROP POLICY IF EXISTS "Workers can update their own applications" ON public.gig_applications;
DROP POLICY IF EXISTS "Managers can view applications for their gigs" ON public.gig_applications;
DROP POLICY IF EXISTS "Managers can update applications status" ON public.gig_applications;

CREATE POLICY "Workers can view their own applications" ON public.gig_applications FOR SELECT TO authenticated USING (auth.uid() = worker_id);
CREATE POLICY "Workers can apply to gigs" ON public.gig_applications FOR INSERT TO authenticated WITH CHECK (auth.uid() = worker_id);
CREATE POLICY "Workers can update their own applications" ON public.gig_applications FOR UPDATE TO authenticated USING (auth.uid() = worker_id);
CREATE POLICY "Managers can view applications for their gigs" ON public.gig_applications FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM gigs WHERE gigs.id = gig_applications.gig_id AND gigs.manager_id = auth.uid()));
CREATE POLICY "Managers can update applications status" ON public.gig_applications FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM gigs WHERE gigs.id = gig_applications.gig_id AND gigs.manager_id = auth.uid()));

-- ===================== gigs =====================
DROP POLICY IF EXISTS "Managers can create gigs" ON public.gigs;
DROP POLICY IF EXISTS "Managers can update their own gigs" ON public.gigs;
DROP POLICY IF EXISTS "Managers can delete their own gigs" ON public.gigs;

CREATE POLICY "Managers can create gigs" ON public.gigs FOR INSERT TO authenticated WITH CHECK ((auth.uid() = manager_id) AND (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "Managers can update their own gigs" ON public.gigs FOR UPDATE TO authenticated USING (auth.uid() = manager_id);
CREATE POLICY "Managers can delete their own gigs" ON public.gigs FOR DELETE TO authenticated USING (auth.uid() = manager_id);

-- ===================== messages =====================
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can mark their messages as read" ON public.messages;
DROP POLICY IF EXISTS "Admins can view all messages" ON public.messages;
DROP POLICY IF EXISTS "Admins can send messages to any conversation" ON public.messages;
DROP POLICY IF EXISTS "Admins can mark any messages as read" ON public.messages;

CREATE POLICY "Users can view messages in their conversations" ON public.messages FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM conversations WHERE conversations.id = messages.conversation_id AND conversations.user_id = auth.uid()));
CREATE POLICY "Users can send messages in their conversations" ON public.messages FOR INSERT TO authenticated WITH CHECK ((EXISTS (SELECT 1 FROM conversations WHERE conversations.id = messages.conversation_id AND conversations.user_id = auth.uid())) AND (auth.uid() = sender_id));
CREATE POLICY "Users can mark their messages as read" ON public.messages FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM conversations WHERE conversations.id = messages.conversation_id AND conversations.user_id = auth.uid()));
CREATE POLICY "Admins can view all messages" ON public.messages FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can send messages to any conversation" ON public.messages FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND (auth.uid() = sender_id));
CREATE POLICY "Admins can mark any messages as read" ON public.messages FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ===================== notifications =====================
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;

CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- ===================== order_items =====================
DROP POLICY IF EXISTS "Users can view their own order items" ON public.order_items;
DROP POLICY IF EXISTS "Users can create order items for their orders" ON public.order_items;
DROP POLICY IF EXISTS "Admins can view all order items" ON public.order_items;
DROP POLICY IF EXISTS "Admins can delete order items" ON public.order_items;

CREATE POLICY "Users can view their own order items" ON public.order_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()));
CREATE POLICY "Users can create order items for their orders" ON public.order_items FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()));
CREATE POLICY "Admins can view all order items" ON public.order_items FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete order items" ON public.order_items FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ===================== points_transactions =====================
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.points_transactions;
DROP POLICY IF EXISTS "Admins can view all transactions" ON public.points_transactions;
DROP POLICY IF EXISTS "Admins can insert transactions" ON public.points_transactions;

CREATE POLICY "Users can view their own points transactions" ON public.points_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all points transactions" ON public.points_transactions FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert points transactions" ON public.points_transactions FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ===================== reviews =====================
DROP POLICY IF EXISTS "Users can create their own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users can update their own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users can delete their own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Admins can delete any review" ON public.reviews;

CREATE POLICY "Users can create their own reviews" ON public.reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own reviews" ON public.reviews FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own reviews" ON public.reviews FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can delete any review" ON public.reviews FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ===================== saved_invoices =====================
DROP POLICY IF EXISTS "Users can view their own invoices" ON public.saved_invoices;
DROP POLICY IF EXISTS "Admins can view all invoices" ON public.saved_invoices;
DROP POLICY IF EXISTS "Admins can create invoices" ON public.saved_invoices;
DROP POLICY IF EXISTS "Admins can update invoices" ON public.saved_invoices;

CREATE POLICY "Users can view their own invoices" ON public.saved_invoices FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = saved_invoices.order_id AND orders.user_id = auth.uid()));
CREATE POLICY "Admins can view all invoices" ON public.saved_invoices FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can create invoices" ON public.saved_invoices FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update invoices" ON public.saved_invoices FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ===================== user_addresses =====================
DROP POLICY IF EXISTS "Users can view their own addresses" ON public.user_addresses;
DROP POLICY IF EXISTS "Users can insert their own addresses" ON public.user_addresses;
DROP POLICY IF EXISTS "Users can update their own addresses" ON public.user_addresses;
DROP POLICY IF EXISTS "Users can delete their own addresses" ON public.user_addresses;

CREATE POLICY "Users can view their own addresses" ON public.user_addresses FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own addresses" ON public.user_addresses FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own addresses" ON public.user_addresses FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own addresses" ON public.user_addresses FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ===================== user_referrals =====================
DROP POLICY IF EXISTS "Users can view their own referrals" ON public.user_referrals;
DROP POLICY IF EXISTS "Users can create referrals" ON public.user_referrals;
DROP POLICY IF EXISTS "Admins can view all referrals" ON public.user_referrals;

CREATE POLICY "Users can view their own referrals" ON public.user_referrals FOR SELECT TO authenticated USING (auth.uid() = referrer_user_id OR auth.uid() = referred_user_id);
CREATE POLICY "Users can create referrals" ON public.user_referrals FOR INSERT TO authenticated WITH CHECK (auth.uid() = referrer_user_id);
CREATE POLICY "Admins can view all referrals" ON public.user_referrals FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ===================== user_task_completions =====================
DROP POLICY IF EXISTS "Users can view their own completions" ON public.user_task_completions;
DROP POLICY IF EXISTS "Admins can view all completions" ON public.user_task_completions;
DROP POLICY IF EXISTS "Only system can insert completions" ON public.user_task_completions;

CREATE POLICY "Users can view their own completions" ON public.user_task_completions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all completions" ON public.user_task_completions FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Only system can insert completions" ON public.user_task_completions FOR INSERT TO authenticated WITH CHECK (false);

-- ===================== wallet_transactions =====================
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.wallet_transactions;
DROP POLICY IF EXISTS "Users can create their own transactions" ON public.wallet_transactions;
DROP POLICY IF EXISTS "Admins can view all transactions" ON public.wallet_transactions;
DROP POLICY IF EXISTS "Admins can insert transactions" ON public.wallet_transactions;
DROP POLICY IF EXISTS "Admins can update transactions" ON public.wallet_transactions;
DROP POLICY IF EXISTS "Admins can delete transactions" ON public.wallet_transactions;

CREATE POLICY "Users can view their own wallet transactions" ON public.wallet_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own wallet transactions" ON public.wallet_transactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all wallet transactions" ON public.wallet_transactions FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert wallet transactions" ON public.wallet_transactions FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update wallet transactions" ON public.wallet_transactions FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete wallet transactions" ON public.wallet_transactions FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ===================== competition_tickets =====================
DROP POLICY IF EXISTS "Users can view their own tickets" ON public.competition_tickets;
DROP POLICY IF EXISTS "Users can purchase tickets" ON public.competition_tickets;
DROP POLICY IF EXISTS "Admins can manage tickets" ON public.competition_tickets;

CREATE POLICY "Users can view their own tickets" ON public.competition_tickets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can purchase tickets" ON public.competition_tickets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage tickets" ON public.competition_tickets FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ===================== user_wallets =====================
DROP POLICY IF EXISTS "Users can view their own wallet" ON public.user_wallets;
DROP POLICY IF EXISTS "Admins can view all wallets" ON public.user_wallets;
DROP POLICY IF EXISTS "Admins can insert wallets" ON public.user_wallets;
DROP POLICY IF EXISTS "Admins can update wallets" ON public.user_wallets;

CREATE POLICY "Users can view their own wallet" ON public.user_wallets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all wallets" ON public.user_wallets FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert wallets" ON public.user_wallets FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update wallets" ON public.user_wallets FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ===================== user_tickets =====================
DROP POLICY IF EXISTS "Users can view their own tickets" ON public.user_tickets;
DROP POLICY IF EXISTS "Admins can view all tickets" ON public.user_tickets;
DROP POLICY IF EXISTS "Admins can manage tickets" ON public.user_tickets;

CREATE POLICY "Users can view their own user tickets" ON public.user_tickets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all user tickets" ON public.user_tickets FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can manage user tickets" ON public.user_tickets FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));