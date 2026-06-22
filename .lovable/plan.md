## المشكلة

1. **حقل التكلفة الأساسي يظهر فارغ/0**: المنتجات لديها قيمة في `products.original_price_usd` فقط، بينما `products.cost_price` فارغ. الكود الحالي يقرأ `cost_price` فقط ولا يرجع لـ `original_price_usd`.
2. **الحفظ لا يحدّث المعروض**: الـ RPC `admin_quick_update_costs` يحدّث `cost_price` فقط، ولا يلمس `original_price_usd`. لذا أي مكان آخر في النظام (والـ dialog عند إعادة فتحه عبر fallback) يستمر بعرض القيمة القديمة من `original_price_usd`.

## الحل (بدون أي حقول جديدة)

### 1. القراءة في `QuickCostEditDialog.tsx`
- اقرأ `cost_price` و `original_price_usd` من `products_admin`.
- المنطق:
  - إذا `cost_price > 0` → استخدمه كقيمة IQD الأساسية.
  - وإلا إذا `original_price_usd > 0` → احسب `original_price_usd × usd_to_iqd_rate` كقيمة IQD أساسية (fallback).
  - وإلا → فارغ.
- اعرضه بالعملة المختارة كما هو الآن.

### 2. الحفظ
- عدّل الـ RPC `admin_quick_update_costs` ليقبل بارامتر اختياري `_original_price_usd` ويحدّث الحقلين معاً في نفس الـ UPDATE:
  - `cost_price = _product_cost` (بالـ IQD)
  - `original_price_usd = _original_price_usd` (بالـ USD)
- في الـ dialog: عند الحفظ احسب القيمتين من الإدخال:
  - `iqd = toIqd(input, currency)`
  - `usd = iqd / usd_to_iqd_rate` (مقرّب لـ 2 منزلة)
  - أرسل الاثنين للـ RPC.
- إذا الإدخال فارغ → أرسل `null` للحقلين.

### 3. الخيارات والألوان
- تبقى كما هي (تم إصلاحها سابقاً): `product_options.cost_iqd` + `price_adjustment`، و `products.colors[].cost_iqd/cost_usd`.

### 4. ضمان ظهور القيم الجديدة بعد الحفظ
- استدعاء `onSaved?.()` يبقى كما هو لتحديث الجدول الأب. سأتأكد أن المكوّن الأب يعيد الجلب فعلاً بعد `onSaved`.

## الملفات المتأثرة

- `src/components/admin/QuickCostEditDialog.tsx` — قراءة `original_price_usd` كـ fallback، وإرسال قيمة USD مع الحفظ.
- migration واحدة لتحديث `admin_quick_update_costs` لقبول `_original_price_usd` وتحديث الحقلين معاً.

## لن أفعل

- لن أنشئ أي أعمدة أو جداول جديدة.
- لن أضيف حقول إدخال جديدة في الشاشة المنبثقة (نفس الحقل الواحد للتكلفة الأساسية).
- لن ألمس منطق الخيارات/الألوان (يعمل).
