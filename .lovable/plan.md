

## ملخص التغيير

إعادة تصميم قسم التسعير في فورم المنتج ليكون واضحاً ومنظماً حسب نوع البيع، مع عمولة يدوية لكل خيار، وحذف الأعمدة/الأقسام المكررة.

## التفاصيل التقنية

### 1. إضافة عمود `commission_iqd` وعمود `other_costs_iqd` لجدول products

```sql
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS commission_iqd numeric DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS other_costs_iqd numeric DEFAULT 0;
```

- `commission_iqd`: العمولة اليدوية بالدينار (يدخلها الأدمن لكل منتج)
- `other_costs_iqd`: تكاليف أخرى للبيع المباشر

### 2. إعادة تصميم `AdminProductPricingSection.tsx` بالكامل

الآلية الجديدة:

```text
┌──────────────────────────────────────────────────┐
│ نوع البيع: ☐ حجز مسبق  ☐ بيع مباشر             │
├──────────────────────────────────────────────────┤
│ إذا حجز مسبق:                                   │
│   نوع الشحن: ○ بحري  ○ جوي                      │
│   ─ بحري: سعر USD + CBM (ط×ع×ا) + العمولة       │
│   ─ جوي:  سعر USD + الوزن kg + العمولة           │
│   المعاينة: (سعر×صرف) + شحن + عمولة = النهائي   │
├──────────────────────────────────────────────────┤
│ إذا بيع مباشر:                                   │
│   سعر USD + تكاليف أخرى + العمولة                │
│   المعاينة: (سعر×صرف) + تكاليف + عمولة = النهائي│
└──────────────────────────────────────────────────┘
```

- العمولة حقل يدوي بالدينار (ليس من `commission_fee` العام)
- حقل "تكاليف أخرى" يظهر فقط للبيع المباشر

### 3. تعديل حساب السعر النهائي في `Admin.tsx` handleProductSubmit

```text
حجز مسبق: price = (price_usd × rate) + shipping_cost + commission_iqd
بيع مباشر: price = (price_usd × rate) + other_costs_iqd + commission_iqd
```

لم نعد نستخدم `settings.commission_fee` العام - بل `commission_iqd` اليدوي.

### 4. حذف الأقسام المكررة من فورم المنتج

- حذف قسم "خيارات الشحن للطلب المسبق (مخصصة)" بالكامل (السطور 2316-2487 تقريباً في Admin.tsx)
- حذف حاسبة الشحن السريع القديمة
- حذف قسم `pre_order_shipping_options` المكرر
- حذف حقول `pre_order_free_shipping_price` و `pre_order_fast_shipping_price` من الفورم
- إبقاء `has_in_stock` و `has_pre_order` كـ checkboxes في خيارات التوفر

### 5. الملفات المتأثرة

| ملف | التعديل |
|-----|---------|
| **Migration** | إضافة `commission_iqd`, `other_costs_iqd` |
| `AdminProductPricingSection.tsx` | إعادة كتابة كاملة بالتصميم الجديد |
| `Admin.tsx` | حذف أقسام الشحن المكررة + تعديل handleProductSubmit |
| `useShippingCalculator.tsx` | لا تغيير (يُستخدم لحساب الشحن فقط) |

