UPDATE public.default_settings
SET setting_value = jsonb_set(
  setting_value::jsonb,
  '{fee_tiers}',
  '[
    {"min_amount": 1, "max_amount": 250000, "fee_percentage": 10},
    {"min_amount": 250001, "max_amount": 500000, "fee_percentage": 7},
    {"min_amount": 500001, "max_amount": 1000000, "fee_percentage": 5},
    {"min_amount": 1000001, "max_amount": 999999999, "fee_percentage": 3}
  ]'::jsonb
),
updated_at = now()
WHERE setting_key = 'partial_payment_settings';