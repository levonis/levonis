# خطة التعديلات

## 1) قاعدة البيانات (migration واحد)

### حقل التكلفة لكل خيار/لون
- `product_options`: إضافة `cost_iqd numeric DEFAULT 0` و `cost_usd numeric DEFAULT 0` (المساعد/الادمن يدخل بالدولار أو باليوان والنظام يحفظ النسختين).
- `products.colors` (jsonb): توسعة الـ shape ليشمل `cost_iqd` و `cost_usd` لكل لون (لا حاجة لـ migration، نضيف الحقول في الـ TS types والـ UI فقط).
- إخفاء هذه الحقول عن غير الأدمن: إضافتها لمصفوفة الأعمدة المحجوبة في `products_admin` view ليصل المساعد للحقول الأساسية فقط (cost_iqd/cost_usd للخيارات تبقى visible للمساعد لأن طلب المستخدم صراحةً يسمح بها).

### المنتجات المعلّقة من المساعد
- `products`: إضافة عمودين:
  - `pending_admin_review boolean DEFAULT false`
  - `created_by_assistant uuid REFERENCES auth.users(id)`
- تعديل trigger الإدراج على `products`: عندما يكون المستخدم المنشئ assistant (وليس admin) → ضبط `pending_admin_review=true`, `is_pricing_updated=false`, `created_by_assistant=auth.uid()`.
- RLS قراءة `products` العامة: إضافة شرط `pending_admin_review=false OR <user is admin/assistant>` بحيث المنتج المعلّق لا يظهر للزبائن.
- عند ضغط الادمن "نشر" (تعبئة التكاليف + حفظ) → trigger يحوّل `pending_admin_review=false` و `is_pricing_updated=true`.

## 2) إخفاء فرق السعر للألوان/الخيارات عن المساعدين

`src/pages/Admin.tsx` (محرّر الخيارات/الألوان داخل ProductForm):
- حقل `price_adjustment` للخيارات والألوان: لفّه بـ `{isAdmin && ...}`.
- إظهار للمساعد فقط حقول: الاسم، حالة التوفر، المخزون، **التكلفة (USD + IQD)** الجديدة.
- للأدمن: كل الحقول كما هي + إضافة حقول التكلفة الجديدة.
- معاينة `OptionPricePreview` تُخفى عن المساعد.

`src/components/admin/AdminProductPricingSection.tsx`:
- قسم العمولات/التكاليف/الشحن الحالي: مخفي للمساعد (موجود مسبقاً).
- **استثناء**: حقول الأبعاد (length/width/height/cm) والوزن (kg) → تصبح **مرئية وقابلة للتعديل من المساعد** (مطلوب لحساب CBM/الكيلو).
- حقول `commission_sea_iqd / commission_air_iqd / commission_direct_iqd`: للمساعد تظهر كحقل قراءة فقط مع أيقونة قفل ونص `••••••` بدلاً من القيمة (مع toggle `link_direct_commission_to_cod` يبقى مخفي تماماً).

## 3) شارة "بانتظار مراجعة الأدمن"

`src/components/admin/ProductsTable.tsx` + قائمة المنتجات في `Admin.tsx`:
- إضافة Badge أحمر/أصفر بارز "بانتظار التسعير من الأدمن" بجانب اسم المنتج عندما `pending_admin_review=true`.
- فرز افتراضي: المنتجات المعلّقة في الأعلى (للأدمن فقط) عبر `.order('pending_admin_review', { ascending: false })`.
- إخفاء البادج عن المساعد (يراه فقط الأدمن — رغم أن المساعد يستطيع رؤية منتجاته المعلّقة كمؤلف).

## 4) زر النشر للأدمن

في dialog تعديل المنتج المعلّق (للأدمن):
- زر إضافي "نشر للمستخدمين" يظهر فقط إذا `pending_admin_review=true`.
- يتحقق أن `cost_iqd` و `commission_*_iqd` ليست صفراً → ثم يحدّث `pending_admin_review=false, is_pricing_updated=true`.
- toast: "تم نشر المنتج بنجاح".

## 5) i18n
إضافة مفاتيح في `ar.ts / en.ts / ku.ts`:
- `pendingAdminReview`, `costPerOption`, `costPerColor`, `publishProduct`, `commissionLocked`, `addedByAssistant`.

## 6) الحفظ على الذاكرة
- memory: assistant product workflow + cost fields per option/color.

## تقنيات

```
products
  + pending_admin_review boolean
  + created_by_assistant uuid

product_options
  + cost_iqd numeric
  + cost_usd numeric
```

ملفات للتعديل:
- migration جديد
- `src/pages/Admin.tsx` (محرّر الخيارات/الألوان + قائمة المنتجات + زر النشر)
- `src/components/admin/AdminProductPricingSection.tsx` (إظهار الأبعاد للمساعد + قفل العمولة)
- `src/components/admin/ProductsTable.tsx` (شارة "معلّق")
- `src/lib/i18n/{ar,en,ku}.ts` + `types.ts`
