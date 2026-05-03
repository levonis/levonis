
-- 1) store_printers: replace permissive read with owner + admin only
DROP POLICY IF EXISTS "Authenticated users can view store printers" ON public.store_printers;
CREATE POLICY "Owners and admins can view store printers"
  ON public.store_printers FOR SELECT
  USING (buyer_user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

-- 2) product_offers: keep table protected; expose a safe view without cost_price
DROP POLICY IF EXISTS "Anyone can view active product offers" ON public.product_offers;
CREATE POLICY "Admins can view all product offers"
  ON public.product_offers FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE OR REPLACE VIEW public.product_offers_public
WITH (security_invoker = true) AS
SELECT id, title, title_ar, title_en, title_ku,
       description, description_ar, description_en, description_ku,
       image_url, images, price, currency, gift_tickets, status,
       stock_quantity, total_sold, created_at, updated_at,
       options, colors, points_reward, show_in_cart
FROM public.product_offers
WHERE status = 'active';

GRANT SELECT ON public.product_offers_public TO anon, authenticated;

-- 3) community_print_requests: drop public-row policy, expose safe view without admin_notes
DROP POLICY IF EXISTS "Approved requests are visible to all" ON public.community_print_requests;

CREATE OR REPLACE VIEW public.community_print_requests_public
WITH (security_invoker = true) AS
SELECT id, user_id, title, description, notes, size, colors, material_type,
       quantity, reference_links, images, image_url, video_url, status,
       created_at, updated_at, accepted_at, accepted_offer_id, delivered_at,
       customer_confirmed_at, escrow_amount, customer_governorate
FROM public.community_print_requests
WHERE status = 'approved';

GRANT SELECT ON public.community_print_requests_public TO anon, authenticated;

-- 4) Remove unused plaintext wallet_pin column from profiles (PINs live hashed in user_wallets.pin_hash)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS wallet_pin;
