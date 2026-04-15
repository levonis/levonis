# **حذف** زر إعادة استخراج الصور واستبداله بزر إخفاء/تحديث المنتج

## الفكرة

النظام يستخدم بالفعل حقل `is_pricing_updated` لإخفاء المنتجات عن المستخدمين — المنتجات التي `is_pricing_updated = false` لا تظهر في الكتالوج ولا صفحات الأقسام. الزر الجديد سيُبدّل هذه القيمة مباشرة.

## التغييرات

### 1) `src/pages/Admin.tsx`

- **حذف** دالة `handleReExtractImages` وحالة `reExtractingImages`
- **إضافة** دالة `handleTogglePricingUpdated(product)` التي تعمل toggle لقيمة `is_pricing_updated`
- **استبدال** الزر في عرض الجدول (سطر ~3276-3289) وعرض الموبايل (سطر ~3360-3362):
  - الأيقونة: `EyeOff` إذا المنتج ظاهر (سيتم إخفاؤه)، `Eye` إذا مخفي (سيتم إظهاره)
  - اللون: أحمر/تحذيري إذا المنتج مخفي (`!is_pricing_updated`)
  - Title: "إخفاء المنتج" أو "إظهار المنتج"

### 2) `src/components/admin/ProductsTable.tsx`

- **استبدال** `onReExtract` بـ `onToggleVisibility` في الـ props والأزرار (سطور 190-191 و 238-239)
- نفس منطق الأيقونة (Eye/EyeOff)

### 3) `src/components/admin/AdminProductsTab.tsx`

- تحديث الـ prop من `onReExtract` إلى `onToggleVisibility`

## الملفات المتأثرة

1. `src/pages/Admin.tsx` — حذف re-extract، إضافة toggle visibility
2. `src/components/admin/ProductsTable.tsx` — تحديث الزر والـ prop
3. `src/components/admin/AdminProductsTab.tsx` — تحديث الـ interface والتمرير