
-- has_admin_access: admin OR assistant
CREATE OR REPLACE FUNCTION public.has_admin_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin'::public.app_role, 'assistant'::public.app_role)
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_admin_access(uuid) TO authenticated, service_role;

-- Expand admin "full" set-returning functions to include assistant
CREATE OR REPLACE FUNCTION public._admin_orders_full()
RETURNS SETOF public.orders
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT * FROM public.orders WHERE public.has_admin_access(auth.uid()); $$;

CREATE OR REPLACE FUNCTION public._admin_order_items_full()
RETURNS SETOF public.order_items
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT * FROM public.order_items WHERE public.has_admin_access(auth.uid()); $$;

CREATE OR REPLACE FUNCTION public._admin_products_full()
RETURNS SETOF public.products
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT * FROM public.products WHERE public.has_admin_access(auth.uid()); $$;

CREATE OR REPLACE FUNCTION public._admin_product_offers_full()
RETURNS SETOF public.product_offers
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT * FROM public.product_offers WHERE public.has_admin_access(auth.uid()); $$;

-- Recreate views with masking for non-strict-admin
DROP VIEW IF EXISTS public.orders_admin CASCADE;
CREATE VIEW public.orders_admin
WITH (security_invoker = on) AS
SELECT
  id, user_id, order_number, status, total_amount, currency,
  shipping_address, phone_number, governorate, shipping_notes,
  created_at, updated_at, shipped_at, delivered_at,
  serial_number_image_url, arrived_warehouse_at, arrived_iraq_at,
  user_confirmed_delivery, user_confirmed_at, auto_confirmed,
  admin_images, admin_files, estimated_delivery_date,
  actual_weight, package_dimensions, customs_declaration_number,
  internal_notes, priority, payment_status, payment_method,
  subtotal, tax_amount, tax_percentage, discount_amount,
  paid_amount, remaining_amount,
  shipping_route_type, shipping_duration_days, shipping_route_waypoints,
  CASE WHEN public.has_role(auth.uid(), 'admin'::public.app_role) THEN admin_product_cost ELSE NULL END AS admin_product_cost,
  CASE WHEN public.has_role(auth.uid(), 'admin'::public.app_role) THEN admin_shipping_cost ELSE NULL END AS admin_shipping_cost,
  CASE WHEN public.has_role(auth.uid(), 'admin'::public.app_role) THEN admin_other_costs ELSE NULL END AS admin_other_costs,
  CASE WHEN public.has_role(auth.uid(), 'admin'::public.app_role) THEN profit_amount ELSE NULL END AS profit_amount,
  CASE WHEN public.has_role(auth.uid(), 'admin'::public.app_role) THEN financial_notes ELSE NULL END AS financial_notes,
  CASE WHEN public.has_role(auth.uid(), 'admin'::public.app_role) THEN admin_paid_amount ELSE NULL END AS admin_paid_amount,
  CASE WHEN public.has_role(auth.uid(), 'admin'::public.app_role) THEN customer_paid_amount ELSE NULL END AS customer_paid_amount,
  confirmed_at, processing_at, purchased_at, on_the_way_at, cancelled_at,
  order_type, stock_deducted, delivery_method,
  card_discount_amount, card_discount_level_name,
  referral_coupon_id, referral_owner_earnings_iqd,
  cod_fee, auto_donation_amount, extra_donation_amount
FROM public._admin_orders_full();

GRANT SELECT ON public.orders_admin TO authenticated, service_role;

DROP VIEW IF EXISTS public.order_items_admin CASCADE;
CREATE VIEW public.order_items_admin
WITH (security_invoker = on) AS
SELECT
  id, order_id, product_id, product_option_id,
  product_name, product_name_ar, selected_option, selected_color,
  quantity, unit_price, total_price, created_at,
  shipping_option_name_ar, shipping_price_adjustment, color_image_url,
  custom_request_id,
  CASE WHEN public.has_role(auth.uid(), 'admin'::public.app_role) THEN cost_price ELSE NULL END AS cost_price,
  serial_number, customer_notes, bundle_id, is_gift
FROM public._admin_order_items_full();

GRANT SELECT ON public.order_items_admin TO authenticated, service_role;

DROP VIEW IF EXISTS public.products_admin CASCADE;
CREATE VIEW public.products_admin
WITH (security_invoker = on) AS
SELECT
  id, name, name_ar, slug, description, description_ar,
  price, original_price, category_id, image_url,
  in_stock, featured, created_at, updated_at, currency,
  images, colors, features, availability_type,
  pre_order_free_shipping_price, pre_order_fast_shipping_price,
  has_in_stock, has_pre_order, pre_order_shipping_options,
  CASE WHEN public.has_role(auth.uid(), 'admin'::public.app_role) THEN cost_price ELSE NULL END AS cost_price,
  taobao_url, taobao_variant_mapping, taobao_last_sync_at,
  taobao_sync_status, taobao_availability_cache,
  points_reward, card_discounts, ticket_reward,
  name_en, name_ku, description_en, description_ku,
  price_usd, shipping_type, weight_kg, length_cm, width_cm, height_cm,
  CASE WHEN public.has_role(auth.uid(), 'admin'::public.app_role) THEN shipping_cost_iqd ELSE NULL END AS shipping_cost_iqd,
  is_pricing_updated,
  CASE WHEN public.has_role(auth.uid(), 'admin'::public.app_role) THEN commission_iqd ELSE NULL END AS commission_iqd,
  CASE WHEN public.has_role(auth.uid(), 'admin'::public.app_role) THEN other_costs_iqd ELSE NULL END AS other_costs_iqd,
  CASE WHEN public.has_role(auth.uid(), 'admin'::public.app_role) THEN commission_sea_iqd ELSE NULL END AS commission_sea_iqd,
  CASE WHEN public.has_role(auth.uid(), 'admin'::public.app_role) THEN commission_air_iqd ELSE NULL END AS commission_air_iqd,
  CASE WHEN public.has_role(auth.uid(), 'admin'::public.app_role) THEN commission_direct_iqd ELSE NULL END AS commission_direct_iqd,
  original_price_usd, direct_sale_price, sea_price, air_price, round_up_price,
  sold_count, direct_stock, pre_order_stock,
  CASE WHEN public.has_role(auth.uid(), 'admin'::public.app_role) THEN personal_delivery_cost ELSE NULL END AS personal_delivery_cost,
  CASE WHEN public.has_role(auth.uid(), 'admin'::public.app_role) THEN referral_earnings_iqd ELSE NULL END AS referral_earnings_iqd,
  cod_enabled, cod_fee_type, cod_fee_value, link_direct_commission_to_cod,
  ai_content, short_summary, searchable_attributes, display_order, brand
FROM public._admin_products_full();

GRANT SELECT ON public.products_admin TO authenticated, service_role;

DROP VIEW IF EXISTS public.product_offers_admin CASCADE;
CREATE VIEW public.product_offers_admin
WITH (security_invoker = on) AS
SELECT
  id, title, title_ar, description, description_ar,
  image_url, images, price, currency, gift_tickets,
  status, stock_quantity, total_sold, created_at, updated_at,
  CASE WHEN public.has_role(auth.uid(), 'admin'::public.app_role) THEN cost_price ELSE NULL END AS cost_price,
  options, colors, points_reward, show_in_cart,
  title_en, title_ku, description_en, description_ku
FROM public._admin_product_offers_full();

GRANT SELECT ON public.product_offers_admin TO authenticated, service_role;

-- admin_update_order: allow admin OR assistant, strip sensitive fields for assistant
CREATE OR REPLACE FUNCTION public.admin_update_order(_order_id uuid, _updates jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  payload jsonb;
  cols text[];
  set_clause text;
  is_strict_admin boolean;
  forbidden text[] := ARRAY[
    'total_amount','subtotal','discount_amount','paid_amount','remaining_amount',
    'admin_product_cost','admin_shipping_cost','admin_other_costs','profit_amount',
    'financial_notes','admin_paid_amount','customer_paid_amount',
    'cod_fee','auto_donation_amount','extra_donation_amount',
    'referral_owner_earnings_iqd','card_discount_amount','tax_amount','tax_percentage'
  ];
  k text;
BEGIN
  IF NOT public.has_admin_access(auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  is_strict_admin := public.has_role(auth.uid(), 'admin'::public.app_role);
  payload := public._admin_filtered_payload('orders', _updates, ARRAY['id','created_at','order_number','user_id']::text[]);
  IF NOT is_strict_admin THEN
    FOREACH k IN ARRAY forbidden LOOP payload := payload - k; END LOOP;
  END IF;
  SELECT array_agg(key) INTO cols FROM jsonb_object_keys(payload) AS key;
  IF cols IS NULL OR array_length(cols, 1) IS NULL THEN RETURN; END IF;
  SELECT string_agg(format('%1$I = (s.r).%1$I', col), ', ') INTO set_clause FROM unnest(cols) AS col;
  EXECUTE format(
    'UPDATE public.orders AS t SET %s FROM (SELECT jsonb_populate_record(NULL::public.orders, $1) AS r) AS s WHERE t.id = $2',
    set_clause
  ) USING payload, _order_id;
END;
$$;

-- admin_update_product: allow admin OR assistant, strip sensitive fields for assistant
CREATE OR REPLACE FUNCTION public.admin_update_product(_product_id uuid, _updates jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  payload jsonb;
  cols text[];
  set_clause text;
  is_strict_admin boolean;
  forbidden text[] := ARRAY[
    'cost_price','commission_iqd','other_costs_iqd',
    'commission_sea_iqd','commission_air_iqd','commission_direct_iqd',
    'shipping_cost_iqd','personal_delivery_cost','referral_earnings_iqd',
    'sea_price','air_price','direct_sale_price','round_up_price','price_usd','original_price_usd'
  ];
  k text;
BEGIN
  IF NOT public.has_admin_access(auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  is_strict_admin := public.has_role(auth.uid(), 'admin'::public.app_role);
  payload := public._admin_filtered_payload('products', _updates, ARRAY['id','created_at']::text[]);
  IF NOT is_strict_admin THEN
    FOREACH k IN ARRAY forbidden LOOP payload := payload - k; END LOOP;
  END IF;
  SELECT array_agg(key) INTO cols FROM jsonb_object_keys(payload) AS key;
  IF cols IS NULL OR array_length(cols, 1) IS NULL THEN RETURN; END IF;
  SELECT string_agg(format('%1$I = (s.r).%1$I', col), ', ') INTO set_clause FROM unnest(cols) AS col;
  EXECUTE format(
    'UPDATE public.products AS t SET %s FROM (SELECT jsonb_populate_record(NULL::public.products, $1) AS r) AS s WHERE t.id = $2',
    set_clause
  ) USING payload, _product_id;
END;
$$;

-- Assistant management RPCs (strict-admin only)
CREATE OR REPLACE FUNCTION public.admin_add_assistant_by_email(_email text)
RETURNS TABLE(user_id uuid, email text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_email text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  SELECT p.id, p.email INTO v_user_id, v_email
  FROM public.profiles p
  WHERE lower(p.email) = lower(trim(_email))
  LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'لا يوجد مستخدم بهذا البريد الإلكتروني' USING ERRCODE = 'P0002';
  END IF;
  IF public.has_role(v_user_id, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'هذا المستخدم أدمن بالفعل' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.user_roles(user_id, role)
  VALUES (v_user_id, 'assistant'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN QUERY SELECT v_user_id, v_email;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_remove_assistant(_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.user_roles
  WHERE user_id = _user_id AND role = 'assistant'::public.app_role;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_assistants()
RETURNS TABLE(user_id uuid, email text, full_name text, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT p.id, p.email, p.full_name, p.created_at
  FROM public.user_roles ur
  JOIN public.profiles p ON p.id = ur.user_id
  WHERE ur.role = 'assistant'::public.app_role
  ORDER BY p.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_add_assistant_by_email(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_remove_assistant(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_assistants() TO authenticated;

-- Assistant RLS on orders/products/etc. (delete remains admin-only via existing policies)
DROP POLICY IF EXISTS "Assistants can view all orders" ON public.orders;
CREATE POLICY "Assistants can view all orders" ON public.orders
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'assistant'::public.app_role));

DROP POLICY IF EXISTS "Assistants can update orders" ON public.orders;
CREATE POLICY "Assistants can update orders" ON public.orders
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'assistant'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'assistant'::public.app_role));

DROP POLICY IF EXISTS "Assistants can view all order_items" ON public.order_items;
CREATE POLICY "Assistants can view all order_items" ON public.order_items
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'assistant'::public.app_role));

DROP POLICY IF EXISTS "Assistants can view all products" ON public.products;
CREATE POLICY "Assistants can view all products" ON public.products
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'assistant'::public.app_role));

DROP POLICY IF EXISTS "Assistants can update products" ON public.products;
CREATE POLICY "Assistants can update products" ON public.products
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'assistant'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'assistant'::public.app_role));

DROP POLICY IF EXISTS "Assistants can view all product_offers" ON public.product_offers;
CREATE POLICY "Assistants can view all product_offers" ON public.product_offers
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'assistant'::public.app_role));

DROP POLICY IF EXISTS "Assistants can update product_offers" ON public.product_offers;
CREATE POLICY "Assistants can update product_offers" ON public.product_offers
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'assistant'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'assistant'::public.app_role));

-- Bulk: assistant full access on listed admin section tables
DO $$
DECLARE
  t text;
  section_tables text[] := ARRAY[
    'notifications','announcements','announcement_settings','banners',
    'coupons','customer_special_coupons','coupon_usage',
    'product_bundles','bundle_items','custom_product_requests','default_settings',
    'points_redeemable_products','points_product_redemptions','points_transactions',
    'loyalty_levels','loyalty_card_codes','loyalty_free_shipping_usage','loyalty_percentage_discount_usage',
    'user_wallets','wallet_transactions','balance_audit_log',
    'conversations','messages','listing_conversations','listing_messages','listing_transactions','listing_fees_settings',
    'saved_invoices','invoice_templates',
    'donations_log',
    'competitions','competition_prizes','competition_tickets','competition_entry_log',
    'product_offer_purchases','ticket_promotions',
    'protection_plans','printer_protection_logs','printer_subscriptions',
    'shipping_settings','delivery_methods','delivery_governorate_exceptions','delivery_category_exceptions',
    'community_complaints','community_print_requests','community_settings','community_customer_profiles','community_categories','community_security_log','community_rate_limits',
    'merchant_applications','merchant_application_private','merchant_badge_settings','merchant_debts','merchant_giveaways','merchant_giveaway_entries','merchant_monthly_orders','merchant_stories',
    'avatar_frames','user_avatar_frames',
    'profiles',
    'story_sections','story_videos',
    'game_prizes','game_store_rewards','game_store_purchases','game_music_stations',
    'mystery_case_rewards','mystery_case_settings','mystery_case_spins',
    'knife_rain_winners','knife_rain_milestones','knife_rain_leaderboard_prizes','knife_rain_settings','knife_rain_milestone_claims',
    'stack_game_winners','stack_game_milestones','stack_game_leaderboard_prizes','stack_game_settings','stack_game_milestone_claims',
    'crossy_road_winners','crossy_road_milestones','crossy_road_leaderboard_prizes','crossy_road_settings','crossy_road_milestone_claims',
    'gacha_advice_cards','gacha_coupons','gacha_dolls','gacha_guaranteed_rules','gacha_machine_prizes','gacha_machines','gacha_marketplace','gacha_rarity_tiers','gacha_settings','gacha_user_coupons','gacha_user_inventory',
    'price_match_requests','wishes','wish_likes',
    'reviews','review_admin_replies','review_reports','review_questions','review_answers','review_helpful',
    'price_protection_claims','parts_discount_requests',
    'random_filament_settings','random_filament_offers','random_filament_orders','random_filament_bans',
    'print_materials','print_machine_profiles','print_requests','print_offers','print_quotations','print_ratings',
    'cart_requests','chat_orders','chat_order_modifications',
    'maintenance_tickets','maintenance_technicians','engineer_ratings',
    'letter_prize_coupons','letter_prize_redemptions','user_collected_letters',
    'main_sections','categories',
    'reel_interactions','reel_views','merchant_reels',
    'card_exclusive_offers','card_gifts','card_discount_limits','membership_cards',
    'gigs','gig_applications'
  ];
BEGIN
  FOREACH t IN ARRAY section_tables LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=t) THEN
      EXECUTE format('DROP POLICY IF EXISTS "Assistants can manage %1$I" ON public.%1$I', t);
      EXECUTE format(
        'CREATE POLICY "Assistants can manage %1$I" ON public.%1$I FOR ALL TO authenticated USING (public.has_role(auth.uid(), ''assistant''::public.app_role)) WITH CHECK (public.has_role(auth.uid(), ''assistant''::public.app_role))',
        t
      );
    END IF;
  END LOOP;
END$$;
