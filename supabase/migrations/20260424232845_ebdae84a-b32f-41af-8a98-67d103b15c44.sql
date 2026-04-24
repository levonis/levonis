-- Banners
ALTER TABLE public.banners
  ADD COLUMN IF NOT EXISTS title_en text,
  ADD COLUMN IF NOT EXISTS title_ku text,
  ADD COLUMN IF NOT EXISTS button_text_en text,
  ADD COLUMN IF NOT EXISTS button_text_ku text;

-- Product offers
ALTER TABLE public.product_offers
  ADD COLUMN IF NOT EXISTS title_en text,
  ADD COLUMN IF NOT EXISTS title_ku text,
  ADD COLUMN IF NOT EXISTS description_en text,
  ADD COLUMN IF NOT EXISTS description_ku text;

-- Product bundles
ALTER TABLE public.product_bundles
  ADD COLUMN IF NOT EXISTS title_ku text,
  ADD COLUMN IF NOT EXISTS description_en text,
  ADD COLUMN IF NOT EXISTS description_ku text;

-- Assistance: coupons, gifts, red envelopes
ALTER TABLE public.assistance_coupons
  ADD COLUMN IF NOT EXISTS title_en text,
  ADD COLUMN IF NOT EXISTS title_ku text,
  ADD COLUMN IF NOT EXISTS description_en text,
  ADD COLUMN IF NOT EXISTS description_ku text;

ALTER TABLE public.assistance_gifts
  ADD COLUMN IF NOT EXISTS title_en text,
  ADD COLUMN IF NOT EXISTS title_ku text,
  ADD COLUMN IF NOT EXISTS description_en text,
  ADD COLUMN IF NOT EXISTS description_ku text;

ALTER TABLE public.assistance_red_envelopes
  ADD COLUMN IF NOT EXISTS title_en text,
  ADD COLUMN IF NOT EXISTS title_ku text,
  ADD COLUMN IF NOT EXISTS description_en text,
  ADD COLUMN IF NOT EXISTS description_ku text;

-- Merchant giveaways
ALTER TABLE public.merchant_giveaways
  ADD COLUMN IF NOT EXISTS title_en text,
  ADD COLUMN IF NOT EXISTS title_ku text,
  ADD COLUMN IF NOT EXISTS description_en text,
  ADD COLUMN IF NOT EXISTS description_ku text;

-- Ticket promotions
ALTER TABLE public.ticket_promotions
  ADD COLUMN IF NOT EXISTS title_en text,
  ADD COLUMN IF NOT EXISTS title_ku text,
  ADD COLUMN IF NOT EXISTS description_en text,
  ADD COLUMN IF NOT EXISTS description_ku text;

-- Daily tasks
ALTER TABLE public.daily_tasks
  ADD COLUMN IF NOT EXISTS title_en text,
  ADD COLUMN IF NOT EXISTS title_ku text,
  ADD COLUMN IF NOT EXISTS description_en text,
  ADD COLUMN IF NOT EXISTS description_ku text;

-- Level prizes
ALTER TABLE public.level_prizes
  ADD COLUMN IF NOT EXISTS title_en text,
  ADD COLUMN IF NOT EXISTS title_ku text,
  ADD COLUMN IF NOT EXISTS description_en text,
  ADD COLUMN IF NOT EXISTS description_ku text;

-- Game store rewards
ALTER TABLE public.game_store_rewards
  ADD COLUMN IF NOT EXISTS title_en text,
  ADD COLUMN IF NOT EXISTS title_ku text,
  ADD COLUMN IF NOT EXISTS description_en text,
  ADD COLUMN IF NOT EXISTS description_ku text;

-- Gigs
ALTER TABLE public.gigs
  ADD COLUMN IF NOT EXISTS title_en text,
  ADD COLUMN IF NOT EXISTS title_ku text,
  ADD COLUMN IF NOT EXISTS description_en text,
  ADD COLUMN IF NOT EXISTS description_ku text;

-- Customer special coupons
ALTER TABLE public.customer_special_coupons
  ADD COLUMN IF NOT EXISTS title_en text,
  ADD COLUMN IF NOT EXISTS title_ku text,
  ADD COLUMN IF NOT EXISTS description_en text,
  ADD COLUMN IF NOT EXISTS description_ku text;

-- Card exclusive offers
ALTER TABLE public.card_exclusive_offers
  ADD COLUMN IF NOT EXISTS title_en text,
  ADD COLUMN IF NOT EXISTS title_ku text,
  ADD COLUMN IF NOT EXISTS description_en text,
  ADD COLUMN IF NOT EXISTS description_ku text;

-- Redemption settings
ALTER TABLE public.redemption_settings
  ADD COLUMN IF NOT EXISTS name_en text,
  ADD COLUMN IF NOT EXISTS name_ku text,
  ADD COLUMN IF NOT EXISTS description_en text,
  ADD COLUMN IF NOT EXISTS description_ku text;

-- Points redeemable products
ALTER TABLE public.points_redeemable_products
  ADD COLUMN IF NOT EXISTS title_en text,
  ADD COLUMN IF NOT EXISTS title_ku text,
  ADD COLUMN IF NOT EXISTS description_en text,
  ADD COLUMN IF NOT EXISTS description_ku text;

-- Mystery case rewards
ALTER TABLE public.mystery_case_rewards
  ADD COLUMN IF NOT EXISTS name_en text,
  ADD COLUMN IF NOT EXISTS name_ku text,
  ADD COLUMN IF NOT EXISTS description_en text,
  ADD COLUMN IF NOT EXISTS description_ku text;

-- Gacha tables
ALTER TABLE public.gacha_machines
  ADD COLUMN IF NOT EXISTS name_en text,
  ADD COLUMN IF NOT EXISTS name_ku text,
  ADD COLUMN IF NOT EXISTS description_en text,
  ADD COLUMN IF NOT EXISTS description_ku text;

ALTER TABLE public.gacha_dolls
  ADD COLUMN IF NOT EXISTS name_en text,
  ADD COLUMN IF NOT EXISTS name_ku text,
  ADD COLUMN IF NOT EXISTS description_en text,
  ADD COLUMN IF NOT EXISTS description_ku text;

ALTER TABLE public.gacha_coupons
  ADD COLUMN IF NOT EXISTS title_en text,
  ADD COLUMN IF NOT EXISTS title_ku text,
  ADD COLUMN IF NOT EXISTS description_en text,
  ADD COLUMN IF NOT EXISTS description_ku text;

ALTER TABLE public.gacha_advice_cards
  ADD COLUMN IF NOT EXISTS title_en text,
  ADD COLUMN IF NOT EXISTS title_ku text;

ALTER TABLE public.gacha_rarity_tiers
  ADD COLUMN IF NOT EXISTS name_en text,
  ADD COLUMN IF NOT EXISTS name_ku text;

ALTER TABLE public.gacha_transactions
  ADD COLUMN IF NOT EXISTS description_en text,
  ADD COLUMN IF NOT EXISTS description_ku text;

-- Avatar frames
ALTER TABLE public.avatar_frames
  ADD COLUMN IF NOT EXISTS name_en text,
  ADD COLUMN IF NOT EXISTS name_ku text;

-- Game music stations
ALTER TABLE public.game_music_stations
  ADD COLUMN IF NOT EXISTS name_en text,
  ADD COLUMN IF NOT EXISTS name_ku text;

-- Product options (already added name_en in migration 9, add name_ku now)
ALTER TABLE public.product_options
  ADD COLUMN IF NOT EXISTS name_ku text;

-- Merchant store categories
ALTER TABLE public.merchant_store_categories
  ADD COLUMN IF NOT EXISTS name_en text,
  ADD COLUMN IF NOT EXISTS name_ku text;

-- Merchant store discounts
ALTER TABLE public.merchant_store_discounts
  ADD COLUMN IF NOT EXISTS title_en text,
  ADD COLUMN IF NOT EXISTS title_ku text,
  ADD COLUMN IF NOT EXISTS description_en text,
  ADD COLUMN IF NOT EXISTS description_ku text;

-- Maintenance technicians
ALTER TABLE public.maintenance_technicians
  ADD COLUMN IF NOT EXISTS name_en text,
  ADD COLUMN IF NOT EXISTS name_ku text;

-- Invoice templates
ALTER TABLE public.invoice_templates
  ADD COLUMN IF NOT EXISTS name_en text,
  ADD COLUMN IF NOT EXISTS name_ku text;

-- Story sections
ALTER TABLE public.story_sections
  ADD COLUMN IF NOT EXISTS title_en text,
  ADD COLUMN IF NOT EXISTS title_ku text;

-- Shipping settings
ALTER TABLE public.shipping_settings
  ADD COLUMN IF NOT EXISTS description_en text,
  ADD COLUMN IF NOT EXISTS description_ku text;

-- Delivery methods (description was added partially in stage 9; ensure description_ku)
ALTER TABLE public.delivery_methods
  ADD COLUMN IF NOT EXISTS name_ku text,
  ADD COLUMN IF NOT EXISTS description_ku text;