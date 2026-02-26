

## ملخص التغيير

تحويل نظام التسعير بالكامل ليعتمد على الدولار كعملة أساسية، مع حساب السعر النهائي بالدينار العراقي تلقائياً (سعر الدولار × سعر القطعة + تكلفة الشحن + العمولة). المنتجات غير المحدّثة بهذا النظام تُخفى تلقائياً.

---

## التفاصيل التقنية

### 1. إضافة أعمدة جديدة لجدول `products`

```sql
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price_usd numeric DEFAULT NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS shipping_type text DEFAULT NULL; -- 'sea' or 'air'
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS weight_kg numeric DEFAULT NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS length_cm numeric DEFAULT NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS width_cm numeric DEFAULT NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS height_cm numeric DEFAULT NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS shipping_cost_iqd numeric DEFAULT NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_pricing_updated boolean DEFAULT false;
```

- `price_usd`: سعر القطعة بالدولار (يدخله الأدمن)
- `shipping_type`: نوع الشحن (بحري/جوي)
- `weight_kg`, `length_cm`, `width_cm`, `height_cm`: بيانات الشحن
- `shipping_cost_iqd`: تكلفة الشحن المحسوبة بالدينار
- `is_pricing_updated`: هل تم تحديث المنتج بالنظام الجديد

### 2. تعديل فورم المنتج في `Admin.tsx`

إضافة قسم جديد بعنوان "التسعير الجديد" يحتوي على:
- **سعر القطعة بالدولار** (حقل إدخال)
- **نوع الشحن** (بحري / جوي) - اختيار
- **حقول الشحن البحري**: الطول، العرض، الارتفاع (سم)
- **حقول الشحن الجوي**: الوزن (كغ) + الأبعاد اختيارياً
- **البيع المباشر** (checkbox `has_in_stock`)
- **عرض تلقائي محسوب**: السعر بالعراقي + تكلفة الشحن + العمولة = المجموع النهائي

عند الحفظ:
- يتم جلب `usd_to_iqd_rate` و إعدادات الشحن من `shipping_settings`
- يُحسب `price` = `price_usd × usd_to_iqd_rate`
- يُحسب `shipping_cost_iqd` حسب نوع الشحن باستخدام `calculateShippingCost`
- يُحسب السعر النهائي: `price = (price_usd × rate) + shipping_cost_iqd + commission_fee`
- يُضبط `is_pricing_updated = true`

### 3. إخفاء المنتجات غير المحدّثة

- في كل صفحة تعرض منتجات للزبائن (`Products.tsx`, `CategoryDetail.tsx`, `Home.tsx`, `ProductDetail.tsx`): إضافة فلتر `.eq('is_pricing_updated', true)` للاستعلامات
- في لوحة الأدمن: عرض جميع المنتجات مع badge تحذيري "غير محدّث" للمنتجات التي `is_pricing_updated = false`

### 4. تعديل إعدادات الشحن `AdminShippingSettings.tsx`

سعر الدولار والعمولة موجودان بالفعل - لا حاجة لتعديل.

### 5. الملفات المتأثرة

| ملف | التعديل |
|-----|---------|
| **Migration** | إضافة الأعمدة الجديدة |
| `src/pages/Admin.tsx` | إضافة حقول التسعير الجديدة + الحساب التلقائي |
| `src/pages/Products.tsx` | فلتر `is_pricing_updated` |
| `src/pages/CategoryDetail.tsx` | فلتر `is_pricing_updated` |
| `src/pages/Home.tsx` | فلتر `is_pricing_updated` |
| `src/components/admin/ProductsTable.tsx` | badge "غير محدّث" |
| `src/hooks/useShippingCalculator.tsx` | لا تعديل (مستخدم كما هو) |

### 6. آلية الحساب

```text
المعادلة النهائية:
┌─────────────────────────────────────────────────┐
│ السعر النهائي = (سعر_الدولار × سعر_الصرف)      │
│                + تكلفة_الشحن (بحري أو جوي)      │
│                + العمولة (1000 د.ع)              │
└─────────────────────────────────────────────────┘

الشحن البحري: CBM × سعر_CBM
الشحن الجوي:  الوزن_مع_التغليف × سعر_الكيلو
```

