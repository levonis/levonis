## المشكلة

عند الاستخراج تظهر رسالة "نجاح" لكن الحقول (الخيارات، الألوان، الصور، الوصف، الأبعاد) تبقى فارغة، ولا تظهر أي رسائل في Console.

## السبب الأرجح

في `src/pages/Admin.tsx` داخل دالة `applyProductInfo` (السطر 1237) أول سطرين:

```ts
const form = formNodeRef.current || (document.querySelector('form') as HTMLFormElement);
if (!form) return;
```

- إذا كان `formNodeRef.current` غير مهيأ في لحظة الاستخراج (سباق mount/remount للنموذج)، يستعمل `document.querySelector('form')` ويلتقط أول `<form>` في الصفحة — وهو غالباً ليس نموذج المنتج. فتفشل كل عمليات `form.querySelector('#name_ar')`/`#description`/... بصمت لأن `setFormValue` يرجع مبكراً عندما العنصر غير موجود.
- النتيجة: لا أخطاء، لا logs، toast النجاح يظهر، والحقول فارغة. وهذا يطابق وصف المستخدم تماماً.

ملاحظة إضافية: حتى الحقول التي لا تعتمد على النموذج (الألوان، الصور، الخيارات، AI content، short_summary) — هذه تستعمل `setUploadedImages` / `setProductOptions` / `setProductColors` مباشرة وليست متأثرة بالنموذج. لذا لو كانت أيضاً فارغة فالسبب الثاني المحتمل هو أن `productInfo` نفسه فارغ من الـ edge function لكن `success=true`. سنغطي الحالتين بـ logging قاطع.

## الخطة

تعديل ملف واحد فقط: `src/pages/Admin.tsx`

### 1) تشخيص قاطع قبل/بعد التعبئة

- في `handleExtractProductInfo` بعد استلام `response.data` (السطر 1160): سجّل ما الذي وصل فعلاً بالتفصيل: `success`, مفاتيح `productInfo`, عدد الصور/الألوان/الخيارات، طول الوصف، الأبعاد.
- في بداية `applyProductInfo` (السطر 1237): سجّل ما إذا كان `formNodeRef.current` موجوداً، وعدد عناصر `<form>` في الـ DOM، و id/aria-label للنموذج الذي تم اختياره (للتأكد إنه نموذج المنتج لا غيره).
- داخل `setFormValue` (السطر 1243): عند فشل العثور على العنصر، سجّل تحذيراً يحدد الـ selector المفقود (مرة واحدة لكل selector لتجنب الإغراق).

### 2) إصلاح اختيار النموذج

- استبدال `document.querySelector('form')` بانتقاء نموذج المنتج تحديداً: البحث عن `form[data-product-form="true"]` (أو selector ثابت لنموذج المحرر)، وإضافة هذا الـ attribute على وسم `<form>` لمحرر المنتج.
- إذا لم يوجد بعد، إعادة المحاولة بـ `requestAnimationFrame` مرة أو مرتين بدل الفشل الصامت، ثم إصدار خطأ واضح في Console وtoast تحذيري.

### 3) ضمان عدم تعليق الإصلاح على النموذج

- الحقول غير المرتبطة بـ DOM (الصور، الألوان، الخيارات، AI content، الأبعاد عبر event) موجودة أصلاً بعد `if (!form) return;` — سأنقلها قبل ذلك الحارس، حتى لو فشل العثور على النموذج، تُملأ الحالة على الأقل (Images/Options/Colors/AI Content).

## ما لن أغيره

- لن أعدّل edge function `extract-product-info` — السجلات السابقة تؤكد أنه يُرجع بيانات كاملة لرابط Bambu (9 خيارات، صور، أبعاد، AI content).
- لا تغيير في قواعد البيانات أو RLS.
- لا تغيير في باقي صفحات الإدارة.

## التحقق

1. فتح محرر المنتج، لصق رابط Bambu، الضغط على استخراج.
2. مراقبة Console: يجب أن تظهر `[AI Extract] response.data` و`[AI Extract] applyProductInfo: form=found, fields=...`
3. التحقق بصرياً: الوصف، الأبعاد، الخيارات، الألوان، الصور كلها تظهر معبأة.
4. إن استمرت أي حقول فارغة، السجلات الجديدة ستحدد بالضبط السبب (selector مفقود، أو productInfo بدون الحقل من الـ edge function).
