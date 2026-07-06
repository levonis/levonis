-- 1) COD commission discount field on membership_cards
ALTER TABLE public.membership_cards
  ADD COLUMN IF NOT EXISTS cod_commission_discount_percentage NUMERIC NOT NULL DEFAULT 0;

-- 2) Fixed price + card link on subscription_duration_tiers
ALTER TABLE public.subscription_duration_tiers
  ADD COLUMN IF NOT EXISTS fixed_price_iqd NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS card_id UUID NULL REFERENCES public.membership_cards(id) ON DELETE CASCADE;

-- 3) Rename cards (use temp keys to avoid unique collisions)
UPDATE public.membership_cards SET card_key = 'levo_plus_tmp' WHERE card_key = 'levo';
UPDATE public.membership_cards SET card_key = 'levo_pro_tmp'  WHERE card_key = 'levo_plus';
UPDATE public.membership_cards SET card_key = 'levo_ultimate' WHERE card_key = 'levo_vip';

UPDATE public.membership_cards
   SET card_key = 'levo_plus',
       name_ar = 'ليفو بلس',
       name_en = 'Levo Plus',
       name_ku = 'Levo Plus',
       wallet_price = 25000,
       cod_commission_discount_percentage = 50
 WHERE card_key = 'levo_plus_tmp';

UPDATE public.membership_cards
   SET card_key = 'levo_pro',
       name_ar = 'ليفو برو',
       name_en = 'Levo Pro',
       name_ku = 'Levo Pro',
       wallet_price = 45000,
       cod_commission_discount_percentage = 100
 WHERE card_key = 'levo_pro_tmp';

UPDATE public.membership_cards
   SET name_ar = 'ليفو التمت',
       name_en = 'Levo Ultimate',
       name_ku = 'Levo Ultimate',
       is_purchasable = false,
       is_vip_plus = true,
       cod_commission_discount_percentage = 100
 WHERE card_key = 'levo_ultimate';

-- 4) Deactivate old generic tiers for cards (kept as archive)
UPDATE public.subscription_duration_tiers
   SET is_active = false
 WHERE target_type = 'card'
   AND card_id IS NULL;

-- 5) Insert new card-specific fixed-price tiers
DO $$
DECLARE
  v_plus_id UUID;
  v_pro_id UUID;
BEGIN
  SELECT id INTO v_plus_id FROM public.membership_cards WHERE card_key = 'levo_plus';
  SELECT id INTO v_pro_id  FROM public.membership_cards WHERE card_key = 'levo_pro';

  -- Levo Plus: 25k / 70k / 125k / 200k
  INSERT INTO public.subscription_duration_tiers
    (target_type, duration_months, discount_percentage, label_ar, label_en, label_ku, is_active, display_order, fixed_price_iqd, card_id)
  VALUES
    ('card', 1,  0, 'شهر واحد',  '1 Month',   '1 Month',   true, 1, 25000,  v_plus_id),
    ('card', 3,  7, '٣ أشهر',    '3 Months',  '3 Months',  true, 2, 70000,  v_plus_id),
    ('card', 6, 17, '٦ أشهر',    '6 Months',  '6 Months',  true, 3, 125000, v_plus_id),
    ('card', 12,34, 'سنة كاملة', '12 Months', '12 Months', true, 4, 200000, v_plus_id)
  ON CONFLICT DO NOTHING;

  -- Levo Pro: 45k / 125k / 225k / 400k
  INSERT INTO public.subscription_duration_tiers
    (target_type, duration_months, discount_percentage, label_ar, label_en, label_ku, is_active, display_order, fixed_price_iqd, card_id)
  VALUES
    ('card', 1,  0, 'شهر واحد',  '1 Month',   '1 Month',   true, 1, 45000,  v_pro_id),
    ('card', 3,  8, '٣ أشهر',    '3 Months',  '3 Months',  true, 2, 125000, v_pro_id),
    ('card', 6,17, '٦ أشهر',    '6 Months',  '6 Months',  true, 3, 225000, v_pro_id),
    ('card', 12,26, 'سنة كاملة', '12 Months', '12 Months', true, 4, 400000, v_pro_id)
  ON CONFLICT DO NOTHING;
END $$;
