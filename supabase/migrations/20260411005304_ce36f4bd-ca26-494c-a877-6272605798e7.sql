
-- 1. Fix cart_items unique index to include sale_type
DROP INDEX IF EXISTS ux_cart_items_non_gift;
CREATE UNIQUE INDEX ux_cart_items_non_gift 
ON public.cart_items (user_id, product_id, product_option_id, selected_color, shipping_option_index, sale_type) 
WHERE (is_gift = false);

-- 2. Add UPDATE policy for crossy_road_settings
CREATE POLICY "Admins can update crossy_road_settings"
ON public.crossy_road_settings FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. Add INSERT policy for crossy_road_settings (for admin)
CREATE POLICY "Admins can insert crossy_road_settings"
ON public.crossy_road_settings FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. Add admin policies for crossy_road_leaderboard_prizes
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crossy_road_leaderboard_prizes' AND policyname = 'Admins can manage crossy lb prizes') THEN
    CREATE POLICY "Admins can manage crossy lb prizes"
    ON public.crossy_road_leaderboard_prizes FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- 5. Fix auto_confirm_delivery to auto-approve automatic reviews
CREATE OR REPLACE FUNCTION public.auto_confirm_delivery()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Auto-confirm orders that were delivered 7+ days ago and not confirmed by user
  UPDATE orders
  SET 
    user_confirmed_delivery = TRUE,
    auto_confirmed = TRUE,
    user_confirmed_at = NOW()
  WHERE 
    status = 'delivered'
    AND delivered_at IS NOT NULL
    AND delivered_at <= NOW() - INTERVAL '7 days'
    AND user_confirmed_delivery = FALSE;
    
  -- Auto-create 5-star reviews for auto-confirmed orders with status 'approved' (not pending)
  INSERT INTO reviews (product_id, user_id, rating, comment, status)
  SELECT DISTINCT 
    oi.product_id,
    o.user_id,
    5,
    'تقييم تلقائي - تم تأكيد الاستلام تلقائياً',
    'approved'
  FROM orders o
  JOIN order_items oi ON o.id = oi.order_id
  WHERE 
    o.auto_confirmed = TRUE
    AND NOT EXISTS (
      SELECT 1 FROM reviews r 
      WHERE r.product_id = oi.product_id 
      AND r.user_id = o.user_id
    );
END;
$$;
