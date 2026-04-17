-- Seed referral_settings with default free delivery min order if not exists
INSERT INTO public.default_settings (setting_key, setting_value)
VALUES ('referral_settings', '{"free_delivery_min_order_iqd": 100000}'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;