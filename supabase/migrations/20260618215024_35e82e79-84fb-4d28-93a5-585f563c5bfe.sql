DO $$
DECLARE rel_name text;
BEGIN
  FOR rel_name IN
    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','v','m','p')
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', rel_name);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', rel_name);
  END LOOP;
END $$;

DO $$
DECLARE tname text;
  public_tables text[] := ARRAY[
    'products','product_options','product_offers','categories','main_sections',
    'banners','announcements','announcement_settings','avatar_frames','loyalty_levels',
    'membership_cards','protection_plans','print_materials','delivery_methods',
    'delivery_category_exceptions','delivery_governorate_exceptions','shipping_settings',
    'bundle_items','product_bundles','community_categories','merchant_public_profiles',
    'merchant_products','merchant_store_categories','merchant_store_discounts',
    'merchant_reels','merchant_stories','story_sections','story_videos',
    'stl_categories','stl_files','game_prizes','gacha_machines','gacha_machine_prizes',
    'gacha_rarity_tiers','gacha_dolls','gacha_advice_cards','competitions','competition_prizes',
    'level_prizes','points_redeemable_products','game_store_rewards','ticket_promotions',
    'default_settings','community_settings','crossy_road_settings','knife_rain_settings',
    'stack_game_settings','mystery_case_settings','space_blaster_settings',
    'gacha_settings','random_filament_settings','random_filament_offers',
    'card_exclusive_offers','game_music_stations','app_versions','invoice_templates',
    'merchant_ad_slots','listing_fees_settings','merchant_badge_settings',
    'crossy_road_milestones','knife_rain_milestones','stack_game_milestones',
    'crossy_road_leaderboard_prizes','knife_rain_leaderboard_prizes','stack_game_leaderboard_prizes',
    'crossy_road_winners','knife_rain_winners','stack_game_winners','crossy_road_high_scores',
    'knife_rain_high_scores','stack_game_high_scores','merchant_giveaways','print_offers',
    'redemption_settings','review_questions','reviews','review_answers','review_helpful',
    'review_admin_replies','seller_reviews','merchant_ratings','merchant_rating_comments',
    'merchant_rating_replies','print_ratings','engineer_ratings','community_print_requests',
    'community_comments','community_likes','wishes','wish_likes','gigs','print_requests',
    'mystery_case_rewards'
  ];
BEGIN
  FOREACH tname IN ARRAY public_tables LOOP
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
               WHERE n.nspname='public' AND c.relname=tname) THEN
      EXECUTE format('GRANT SELECT ON public.%I TO anon', tname);
    END IF;
  END LOOP;
END $$;

REVOKE SELECT (admin_product_cost, admin_shipping_cost, admin_other_costs, profit_amount, financial_notes, internal_notes), UPDATE (admin_product_cost, admin_shipping_cost, admin_other_costs, profit_amount, financial_notes, internal_notes) ON public.orders FROM authenticated;
REVOKE SELECT (cost_price), UPDATE (cost_price) ON public.order_items FROM authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='cost') THEN
    EXECUTE 'REVOKE SELECT (cost), UPDATE (cost) ON public.products FROM authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='commission') THEN
    EXECUTE 'REVOKE SELECT (commission), UPDATE (commission) ON public.products FROM authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='shipping_cost') THEN
    EXECUTE 'REVOKE SELECT (shipping_cost), UPDATE (shipping_cost) ON public.products FROM authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='product_offers' AND column_name='cost_price') THEN
    EXECUTE 'REVOKE SELECT (cost_price), UPDATE (cost_price) ON public.product_offers FROM authenticated';
  END IF;
END $$;