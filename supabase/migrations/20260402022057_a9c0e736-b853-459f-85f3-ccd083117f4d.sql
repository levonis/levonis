DELETE FROM public.shipping_settings 
WHERE setting_key IN ('commission_fee', 'air_usa_kg_price', 'air_usa_weight_buffer_percent');