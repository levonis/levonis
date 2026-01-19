-- Add more features to loyalty_levels table
ALTER TABLE public.loyalty_levels
ADD COLUMN IF NOT EXISTS vip_support BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS special_name_style JSONB DEFAULT '{"enabled": false, "color": null, "glow": false, "badge_icon": null}'::jsonb,
ADD COLUMN IF NOT EXISTS profile_effects JSONB DEFAULT '{"enabled": false, "border_color": null, "background_glow": false, "avatar_frame": null}'::jsonb,
ADD COLUMN IF NOT EXISTS priority_shipping BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS early_access BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS exclusive_products BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS monthly_free_shipping INTEGER DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN public.loyalty_levels.vip_support IS 'VIP customer support access';
COMMENT ON COLUMN public.loyalty_levels.special_name_style IS 'Special name styling: color, glow effect, badge icon';
COMMENT ON COLUMN public.loyalty_levels.profile_effects IS 'Profile visual effects: border, glow, avatar frame';
COMMENT ON COLUMN public.loyalty_levels.priority_shipping IS 'Priority shipping access';
COMMENT ON COLUMN public.loyalty_levels.early_access IS 'Early access to new products';
COMMENT ON COLUMN public.loyalty_levels.exclusive_products IS 'Access to exclusive products';
COMMENT ON COLUMN public.loyalty_levels.monthly_free_shipping IS 'Number of free shipping per month';