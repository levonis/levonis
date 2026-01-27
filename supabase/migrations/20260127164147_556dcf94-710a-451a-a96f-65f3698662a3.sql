-- Add new columns for customer print requests (quantity, payment method, address, commission)
ALTER TABLE public.community_print_requests 
ADD COLUMN IF NOT EXISTS quantity integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'full_advance' CHECK (payment_method IN ('full_advance', 'quarter_advance', 'half_advance', 'cod')),
ADD COLUMN IF NOT EXISTS customer_address_id uuid REFERENCES public.user_addresses(id),
ADD COLUMN IF NOT EXISTS customer_governorate text,
ADD COLUMN IF NOT EXISTS payment_commission_rate numeric(5,4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_commission_amount integer DEFAULT 0;

-- Add community payment commission settings
INSERT INTO public.default_settings (setting_key, setting_value)
VALUES (
  'community_payment_commissions',
  '{
    "full_advance": {
      "rate": 0,
      "label_ar": "دفع كامل مقدماً",
      "description_ar": "الدفع الكامل عبر المنصة - بدون عمولة إضافية"
    },
    "quarter_advance": {
      "rate": 0.06,
      "label_ar": "ربع المبلغ مقدماً",
      "description_ar": "دفع 25% مقدماً والباقي عند الاستلام - عمولة 6%"
    },
    "half_advance": {
      "rate": 0.06,
      "label_ar": "نصف المبلغ مقدماً",
      "description_ar": "دفع 50% مقدماً والباقي عند الاستلام - عمولة 6%"
    },
    "cod": {
      "rate": 0.10,
      "label_ar": "الدفع عند الاستلام",
      "description_ar": "دفع كامل المبلغ عند الاستلام - عمولة 10%"
    }
  }'::jsonb
)
ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value;