-- Enable trigger for admin notifications on new orders
DROP TRIGGER IF EXISTS notify_admins_new_order_trigger ON public.orders;
CREATE TRIGGER notify_admins_new_order_trigger
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admins_new_order();

-- Ensure default_settings table has product_defaults if not exists
INSERT INTO public.default_settings (setting_key, setting_value)
VALUES (
  'product_defaults',
  '{
    "currency": "دينار عراقي",
    "has_in_stock": true,
    "has_pre_order": true,
    "availability_type": "pre_order",
    "in_stock": true,
    "featured": false,
    "pre_order_shipping_options": [
      {
        "name": "Free Shipping (45 days)",
        "name_ar": "شحن مجاني (45 يومًا)",
        "price_adjustment": 0
      }
    ]
  }'::jsonb
)
ON CONFLICT (setting_key) DO NOTHING;