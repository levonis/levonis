-- إضافة عمود صورة اللون في order_items
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS color_image_url TEXT;

-- إضافة تعليق على العمود
COMMENT ON COLUMN order_items.color_image_url IS 'رابط صورة اللون المختار';

-- إضافة عمود اسم الخيار المختار
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS selected_option TEXT;

COMMENT ON COLUMN order_items.selected_option IS 'اسم الخيار المختار بالعربي';