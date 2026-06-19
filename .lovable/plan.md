## المشكلتان

1. **زر تحويل اليوان وحقل سعر البيع المضاف للخيارات/الألوان لا يظهر للمساعد** — السبب أن البلوك مغلّف بـ `isAdmin && (...)` في `src/pages/Admin.tsx` (سطر 3240 للخيارات، سطر 3530 للألوان).
2. **خطأ `Could not find the function public.admin_update_product(_updates) in the schema cache` عند المساعد** — الدالة في قاعدة البيانات صحيحة وبتوقيع `(_product_id uuid, _updates jsonb)`، لكن كاش PostgREST قديم ولا يرى التوقيع الحالي.

## الحل

### 1) إظهار الحقول للمساعد — `src/pages/Admin.tsx`
- استبدال `{isAdmin && (` بـ `{isAdminOrAssistant && (` حول بلوك "سعر البيع المضاف ($)" + `CnyConvertButton` + `OptionPricePreview` للخيارات (~سطر 3240–3263).
- استبدال `{isAdmin && (` بـ `{isAdminOrAssistant && (` حول بلوك "سعر البيع لهذا اللون (د.ع)" + `CnyConvertButton` + `ColorPricePreview` للألوان (~سطر 3530–3551).
- لا تغيير في حقول التكلفة الموجودة (متاحة أصلاً للاثنين).

ملاحظة: `price_adjustment` (للخيارات) يُحفظ مباشرة في `product_options` عبر سياسة RLS الجديدة للمساعد. أما `colors` فهي عمود JSON على جدول `products` ويمر عبر `admin_update_product`؛ القائمة `forbidden` تستبعد فقط أعمدة `products` الحساسة (price_usd, sea_price, …) ولا تشمل عمود `colors`، لذا سيُحفظ سعر اللون بشكل صحيح للمساعد.

### 2) تحديث كاش PostgREST — migration جديدة
- إعادة `CREATE OR REPLACE` لدالة `admin_update_product(_product_id uuid, _updates jsonb)` و`admin_create_product(_values jsonb)` بنفس الجسم الحالي (لإجبار إعادة التسجيل).
- إصدار `NOTIFY pgrst, 'reload schema';` لإجبار PostgREST على تحديث الكاش فوراً.

### ما لن يتغيّر
- لا تغيير في توقيع الدوال أو منطقها.
- لا تغيير في `adminMutations.ts` أو في حفظ الخيارات/الألوان.
- لا تغيير على صلاحيات التكلفة/الأرباح للمساعد.
