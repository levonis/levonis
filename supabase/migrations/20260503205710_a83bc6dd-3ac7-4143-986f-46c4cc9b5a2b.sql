
-- ========= 1. SETTINGS (singleton) =========
CREATE TABLE public.random_filament_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled boolean NOT NULL DEFAULT false,
  category_ids uuid[] NOT NULL DEFAULT '{}',
  direct_price_iqd numeric NOT NULL DEFAULT 0,
  pre_order_price_iqd numeric NOT NULL DEFAULT 0,
  title_ar text NOT NULL DEFAULT 'فلمنت عشوائي',
  description_ar text NOT NULL DEFAULT 'ادفع واكتشف! النوع واللون مفاجأة — يكشف بعد الدفع من المحفظة.',
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.random_filament_settings (enabled) VALUES (false);

ALTER TABLE public.random_filament_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read settings"
  ON public.random_filament_settings FOR SELECT USING (true);

CREATE POLICY "Admins manage settings"
  ON public.random_filament_settings FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER random_filament_settings_updated_at
  BEFORE UPDATE ON public.random_filament_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========= 2. ORDERS / SELECTIONS =========
CREATE TABLE public.random_filament_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  cart_item_id uuid NOT NULL UNIQUE REFERENCES public.cart_items(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  category_id uuid NOT NULL REFERENCES public.categories(id),
  sale_type text NOT NULL CHECK (sale_type IN ('direct','preorder')),
  product_id uuid NOT NULL REFERENCES public.products(id),
  product_option_id uuid REFERENCES public.product_options(id),
  selected_color text,
  price_iqd numeric NOT NULL,
  revealed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rfo_user ON public.random_filament_orders(user_id);
CREATE INDEX idx_rfo_order ON public.random_filament_orders(order_id);

ALTER TABLE public.random_filament_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User reads own random orders"
  ON public.random_filament_orders FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin manages random orders"
  ON public.random_filament_orders FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ========= 3. BANS =========
CREATE TABLE public.random_filament_bans (
  user_id uuid PRIMARY KEY,
  reason text NOT NULL DEFAULT 'محاولة إلغاء طلب فلمنت عشوائي',
  banned_at timestamptz NOT NULL DEFAULT now(),
  banned_by uuid
);

ALTER TABLE public.random_filament_bans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User reads own ban"
  ON public.random_filament_bans FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin manages bans"
  ON public.random_filament_bans FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ========= 4. CREATE RANDOM ORDER RPC =========
CREATE OR REPLACE FUNCTION public.create_random_filament_order(
  p_category_id uuid,
  p_sale_type text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_settings public.random_filament_settings;
  v_product public.products;
  v_option public.product_options;
  v_color text;
  v_color_image text;
  v_price numeric;
  v_cart_item_id uuid;
  v_rfo_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF p_sale_type NOT IN ('direct','preorder') THEN
    RAISE EXCEPTION 'INVALID_SALE_TYPE';
  END IF;

  IF EXISTS (SELECT 1 FROM public.random_filament_bans WHERE user_id = v_user) THEN
    RAISE EXCEPTION 'USER_BANNED';
  END IF;

  SELECT * INTO v_settings FROM public.random_filament_settings LIMIT 1;
  IF NOT v_settings.enabled THEN
    RAISE EXCEPTION 'SECTION_DISABLED';
  END IF;
  IF NOT (p_category_id = ANY(v_settings.category_ids)) THEN
    RAISE EXCEPTION 'CATEGORY_NOT_ALLOWED';
  END IF;

  v_price := CASE WHEN p_sale_type = 'direct'
                  THEN v_settings.direct_price_iqd
                  ELSE v_settings.pre_order_price_iqd END;
  IF v_price <= 0 THEN
    RAISE EXCEPTION 'PRICE_NOT_CONFIGURED';
  END IF;

  -- pick random product in category that has a usable option
  IF p_sale_type = 'direct' THEN
    SELECT p.* INTO v_product
    FROM public.products p
    WHERE p.category_id = p_category_id
      AND p.in_stock = true
      AND EXISTS (
        SELECT 1 FROM public.product_options o
        WHERE o.product_id = p.id
          AND COALESCE(o.available_for_direct_sale, false) = true
          AND COALESCE(o.stock_quantity, 0) > 0
      )
    ORDER BY random()
    LIMIT 1;
  ELSE
    SELECT p.* INTO v_product
    FROM public.products p
    WHERE p.category_id = p_category_id
      AND EXISTS (
        SELECT 1 FROM public.product_options o
        WHERE o.product_id = p.id
          AND COALESCE(o.available_for_pre_order, true) = true
      )
    ORDER BY random()
    LIMIT 1;
  END IF;

  IF v_product.id IS NULL THEN
    RAISE EXCEPTION 'NO_PRODUCT_AVAILABLE';
  END IF;

  -- pick random option (color)
  IF p_sale_type = 'direct' THEN
    SELECT * INTO v_option FROM public.product_options
    WHERE product_id = v_product.id
      AND COALESCE(available_for_direct_sale, false) = true
      AND COALESCE(stock_quantity, 0) > 0
    ORDER BY random() LIMIT 1;
  ELSE
    SELECT * INTO v_option FROM public.product_options
    WHERE product_id = v_product.id
      AND COALESCE(available_for_pre_order, true) = true
    ORDER BY random() LIMIT 1;
  END IF;

  IF v_option.id IS NULL THEN
    RAISE EXCEPTION 'NO_COLOR_AVAILABLE';
  END IF;

  v_color := COALESCE(v_option.name_ar, v_option.name);
  v_color_image := v_option.image_url;

  -- insert cart item (locked + masked)
  INSERT INTO public.cart_items (
    user_id, product_id, product_option_id, selected_color,
    color_image_url, quantity, sale_type, is_locked
  ) VALUES (
    v_user, v_product.id, v_option.id, v_color,
    v_color_image, 1, p_sale_type, true
  ) RETURNING id INTO v_cart_item_id;

  INSERT INTO public.random_filament_orders (
    user_id, cart_item_id, category_id, sale_type,
    product_id, product_option_id, selected_color, price_iqd
  ) VALUES (
    v_user, v_cart_item_id, p_category_id, p_sale_type,
    v_product.id, v_option.id, v_color, v_price
  ) RETURNING id INTO v_rfo_id;

  RETURN jsonb_build_object(
    'success', true,
    'cart_item_id', v_cart_item_id,
    'random_order_id', v_rfo_id,
    'price_iqd', v_price
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_random_filament_order(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_random_filament_order(uuid,text) TO authenticated;

-- ========= 5. REVEAL ON ORDER PLACEMENT =========
CREATE OR REPLACE FUNCTION public.reveal_random_filament_orders(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_owner uuid;
BEGIN
  SELECT user_id INTO v_owner FROM public.orders WHERE id = p_order_id;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;
  IF v_owner <> v_user AND NOT public.has_role(v_user,'admin') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  UPDATE public.random_filament_orders rfo
  SET order_id = p_order_id,
      revealed_at = COALESCE(revealed_at, now())
  FROM public.order_items oi
  WHERE oi.order_id = p_order_id
    AND oi.product_id = rfo.product_id
    AND COALESCE(oi.product_option_id::text,'') = COALESCE(rfo.product_option_id::text,'')
    AND rfo.user_id = v_owner
    AND rfo.order_id IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reveal_random_filament_orders(uuid) TO authenticated;

-- ========= 6. PREVENT CANCELLATION =========
CREATE OR REPLACE FUNCTION public.prevent_random_filament_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    IF EXISTS (SELECT 1 FROM public.random_filament_orders WHERE order_id = NEW.id) THEN
      RAISE EXCEPTION 'RANDOM_FILAMENT_CANCEL_FORBIDDEN';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_random_filament_cancel ON public.orders;
CREATE TRIGGER trg_prevent_random_filament_cancel
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.prevent_random_filament_cancel();

-- ========= 7. USER CANCEL ATTEMPT => BAN =========
CREATE OR REPLACE FUNCTION public.request_cancel_random_filament_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_owner uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;

  SELECT user_id INTO v_owner FROM public.orders WHERE id = p_order_id;
  IF v_owner IS NULL OR v_owner <> v_user THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.random_filament_orders WHERE order_id = p_order_id) THEN
    RAISE EXCEPTION 'NOT_RANDOM_ORDER';
  END IF;

  INSERT INTO public.random_filament_bans (user_id, reason)
  VALUES (v_user, 'محاولة إلغاء طلب فلمنت عشوائي')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN jsonb_build_object('cancelled', false, 'banned', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_cancel_random_filament_order(uuid) TO authenticated;
