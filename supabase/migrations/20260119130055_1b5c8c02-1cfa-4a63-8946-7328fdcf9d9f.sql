-- Add new shipping settings
INSERT INTO shipping_settings (setting_key, setting_value, description_ar)
VALUES 
  ('air_china_weight_safety_margin', 20, 'نسبة الاحتياط للشحن الجوي من الصين (%)'),
  ('usd_to_iqd_rate', 1410, 'سعر الدولار بالدينار العراقي')
ON CONFLICT (setting_key) DO NOTHING;