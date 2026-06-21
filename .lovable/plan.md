## الهدف
إضافة نوع شحن جديد **بري (land)** يعتمد على الوزن الفعلي فقط (بدون وزن حجمي)، مع سعر منفصل لكل كغ في إعدادات الشحن (مثال: 4$/كغ)، يمكن تفعيله اختيارياً مع بقية أنواع الشحن (بحري/جوي).

---

## 1) إعدادات الشحن (Admin Shipping Settings + DB)

إضافة مفاتيح جديدة لجدول `shipping_settings`:
- `land_price_per_kg_usd` — السعر بالدولار لكل كغ (افتراضي 4)
- `land_weight_safety_margin` — هامش أمان % (افتراضي 0) — اختياري للمستقبل
- `land_padding_cm` — غير مستخدم (الشحن البري لا يحسب وزن حجمي)

تحديث `src/pages/AdminShippingSettings.tsx` لعرض/تعديل حقل **سعر الشحن البري لكل كغ ($)** ضمن قسم منفصل، مع زر "إعادة حساب الكل" يدعم النوع الجديد.

تحديث `src/hooks/useShippingCalculator.tsx`:
- إضافة الإعداد الجديد إلى `ShippingSettings`
- إضافة نوع `'land'` إلى `ShippingType`
- في `calculateShippingCost`: عند `shippingType === 'land'` يُحسب: `actualWeight × land_price_per_kg_usd × usd_to_iqd_rate` (بدون وزن حجمي ولا padding). إذا الوزن مفقود → رسالة تنبيه.

---

## 2) المنتجات (DB schema)

أعمدة جديدة على `products`:
- `land_price` (numeric) — السعر النهائي بالدينار لخيار البري (يحسبه السيرفر تلقائياً)
- `commission_land_iqd` (numeric, default 0) — عمولة الشحن البري

تغيير قيمة `shipping_type`: من سلسلة محدودة (`sea/air/both`) إلى **سلسلة tokens مفصولة بفواصل** مثل: `sea`, `air`, `land`, `sea,air`, `sea,land`, `air,land`, `sea,air,land`.
- migration توافقية: تحويل `'both'` → `'sea,air'` تلقائياً.
- helper جديد `src/lib/shippingType.ts` بدوال `hasShipping(type, 'sea'|'air'|'land')` و `parseShippingTokens(type)` لاستخدامها بدل المقارنات المباشرة `=== 'sea'` المنتشرة.

تحديث دالة `public.recompute_product_prices(uuid)` (و trigger إعدادات الشحن):
- حساب `v_land_ship = round(weight_kg × land_price_per_kg_usd × usd_to_iqd_rate)`
- إذا التوكنز تشمل `land` و `has_pre_order`: `v_land_price = price_iqd + v_land_ship + commission_land_iqd + pdc + ref`
- إدراج `v_land_price` ضمن قائمة المرشحين لسعر `price` الرئيسي ولفرع البيع المباشر بنفس منطق `sea/air`.

---

## 3) لوحة إدخال المنتج

`src/components/admin/AdminProductPricingSection.tsx`:
- إضافة Checkbox ثالث **"شحن بري"** بجانب بحري/جوي.
- حقل **العمولة - بري (د.ع)** → `commission_land_iqd`.
- منطق `shippingTypeValue` يبني السلسلة من 3 booleans (`hasSea/hasAir/hasLand`).
- إضافة معاينة حساب البري في قسم "تفاصيل الشحن" (تستدعي `calculateShippingCost('china','land',...)`).
- إضافة hidden input `commission_land_iqd`.

`src/pages/Admin.tsx` (`handleProductSubmit`): إضافة `commission_land_iqd` ضمن الحقول المحفوظة.

---

## 4) عرض المنتج وعربة التسوق

`src/pages/ProductDetail.tsx`:
- إضافة خيار البري ضمن `pre_order_shipping_options` المبنية افتراضياً.
- نص ترجمة `pd_shipping_land` ("شحن بري — توصيل خلال 20-30 يوم" — المدة قابلة للتعديل لاحقاً).
- شمل `land_price` في `select` queries وفي منطق اختيار السعر حسب التوكن.

`src/hooks/useCart.tsx`, `src/lib/priceGuard.ts`, `src/lib/cardPrice.ts`:
- إضافة `land_price` و `commission_land_iqd` ضمن الأنواع.
- استبدال المقارنات `st === 'sea'` / `'air'` / `'both'` باستدعاء `hasShipping(...)` من helper.
- في `priceGuard`: عند `shippingType === 'land'` يُختار `land_price`.

`src/lib/i18n/{ar,en,ku}.ts` + `types.ts`: إضافة مفاتيح `pd_shipping_land`, `product_shipping_land`, `commission_land_label`, إلخ.

---

## 5) Order Items / Cart Requests

`order_items` و `cart_items` يخزّنان `shipping_type` كنص حر — لا حاجة لتغيير schema، فقط دعم القيمة `'land'` في عرض الطلبات/الفواتير (`AdminOrders.tsx`, تسميات في i18n).

---

## التفاصيل التقنية المختصرة

```text
shipping_type tokens:
  'sea' | 'air' | 'land' | 'sea,air' | 'sea,land' | 'air,land' | 'sea,air,land'
  legacy 'both' -> 'sea,air' (migration UPDATE)

land shipping cost (IQD):
  weight_kg * land_price_per_kg_usd * usd_to_iqd_rate
  (no volumetric, no padding, optional safety margin reserved)

new product columns:
  land_price numeric NULL
  commission_land_iqd numeric DEFAULT 0

new shipping_settings rows:
  land_price_per_kg_usd = 4
  land_weight_safety_margin = 0
```

---

## أسئلة قبل التنفيذ (إن وُجدت)
- هل تريد هامش أمان على الوزن (مثل الجوي 20%)؟ افتراضياً سأضعه **0%** ويمكن تعديله من الإعدادات.
- المدة التقديرية للشحن البري التي ستظهر للزبون؟ سأضع **20-30 يوم** كقيمة افتراضية قابلة للتعديل بالترجمة.
