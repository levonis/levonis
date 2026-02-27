

# خطة: إصلاح أسعار البيع المباشر + تكرار الخيارات في السلة

## المشاكل المكتشفة

### 1. تكرار الخيارات في قاعدة البيانات
المنتج `a7059f64` يحتوي على 4 خيارات بدلاً من 2 — نسختان مكررتان:
- "بكرة كاملة" مكررة (id: `b6141f0a` و `a2af2677`)
- "تعبئة بدون روله" مكررة (id: `a8751134` و `f7eaef75`)

**السبب**: عند تعديل المنتج، يتم حذف الخيارات القديمة وإضافة الجديدة — لكن يبدو أن عملية الحذف لا تنتظر اكتمالها قبل الإدراج. سنضيف `await` والتأكد من الحذف الكامل.

### 2. سعر البيع المباشر لا يظهر في السلة
في `Cart.tsx` (سطور 1022-1028) و `GroupedCartItem.tsx` (سطور 35-39):
- يستخدم دائماً `product.price` (أقل سعر) بدون التحقق من `sale_type`
- لا يستخدم `direct_sale_price` أو `sea_price` / `air_price`

### 3. سعر اللون لا يتحدث حسب نوع البيع
عند اختيار لون في البيع المباشر، يجب استخدام `colorData.direct_sale_price` بدلاً من `colorData.price`.

---

## الإصلاحات

### 1. `src/pages/Admin.tsx` — منع تكرار الخيارات
- التأكد من `await` كامل عند حذف الخيارات القديمة قبل إدراج الجديدة

### 2. `src/pages/Cart.tsx` — إصلاح حساب سعر العنصر المفرد
في سطور 1022-1038: إضافة نفس منطق الأسعار الموجود في `useCart.tsx`:
```
const isDirect = item.sale_type === 'direct';
if (isDirect && item.products?.direct_sale_price) → استخدم direct_sale_price
if (!isDirect) → استخدم sea_price / air_price حسب shipping_type
// اللون: isDirect ? colorData.direct_sale_price : colorData.price
```

### 3. `src/components/GroupedCartItem.tsx` — إصلاح `calculateItemPrice`
في سطور 35-39: نفس المنطق — استخدام `direct_sale_price` / `sea_price` / `air_price` حسب `sale_type` بدلاً من `product.price` دائماً.

### 4. تنظيف الخيارات المكررة
تشغيل migration لحذف الخيارات المكررة من قاعدة البيانات.

### الملفات المتأثرة
- `src/pages/Admin.tsx` — await delete options
- `src/pages/Cart.tsx` — حساب سعر العنصر
- `src/components/GroupedCartItem.tsx` — حساب سعر العنصر
- Migration SQL — تنظيف الخيارات المكررة

