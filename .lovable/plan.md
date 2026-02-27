

# خطة: إصلاح عرض الأسعار المختلفة (بيع مباشر / طلب مسبق بحري / جوي)

## المشكلة
عند حفظ المنتج في الأدمن، يتم حساب أسعار مختلفة لكل نوع بيع:
- **بحري**: سعر USD × سعر الصرف + شحن بحري + عمولة بحري
- **جوي**: سعر USD × سعر الصرف + شحن جوي + عمولة جوي  
- **بيع مباشر**: سعر USD × سعر الصرف + تكاليف أخرى + عمولة مباشر

لكن يُخزّن فقط **أقل سعر** في `product.price`، ولا يُخزّن `direct_sale_price` ولا أسعار الشحن المنفصلة. فتظهر نفس الأسعار لكل الأنواع.

## الحل

### 1. إضافة أعمدة جديدة للأسعار المنفصلة (Migration)
```sql
ALTER TABLE products ADD COLUMN IF NOT EXISTS sea_price numeric;
ALTER TABLE products ADD COLUMN IF NOT EXISTS air_price numeric;
```
- `direct_sale_price` موجود بالفعل لكنه فارغ
- `sea_price` و `air_price` جديدة لأسعار الطلب المسبق

### 2. تحديث حفظ المنتج في Admin.tsx
بعد حساب الأسعار (سطر 1260-1262)، تخزين كل سعر في العمود المناسب:
- `values.direct_sale_price = priceIqd + otherCosts + commissionDirect` (عند `hasInStock`)
- `values.sea_price = priceIqd + seaShipping + commissionSea` (عند شحن بحري)
- `values.air_price = priceIqd + airShipping + commissionAir` (عند شحن جوي)
- `values.price` يبقى الأقل (للعرض في القوائم)

### 3. تحديث ProductDetail.tsx - `getPrice()`
```
if (activeSaleType === 'direct') → product.direct_sale_price || product.price
if (activeSaleType === 'preorder'):
  - إذا كان shipping_type = 'sea' → product.sea_price || product.price  
  - إذا كان shipping_type = 'air' → product.air_price || product.price
  - إذا كان shipping_type = 'both' → عرض خيارات الشحن مع أسعار مختلفة
```

عند `shipping_type = 'both'`, نملأ `pre_order_shipping_options` تلقائياً بخياري البحري والجوي مع `price_adjustment` محسوب من الفرق.

### 4. تحديث الأسعار في Cart وuseCart
- `Cart.tsx`: استخدام `direct_sale_price` / `sea_price` / `air_price` حسب نوع الطلب
- `useCart.tsx`: جلب الأعمدة الجديدة وحساب السعر الصحيح

### الملفات المتأثرة
- Migration SQL — إضافة `sea_price`, `air_price`
- `src/pages/Admin.tsx` — تخزين الأسعار المنفصلة عند الحفظ
- `src/pages/ProductDetail.tsx` — عرض السعر حسب النوع المختار
- `src/hooks/useCart.tsx` — حساب السعر الصحيح بالسلة
- `src/pages/Cart.tsx` — عرض السعر الصحيح بالسلة

