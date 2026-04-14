
## المشكلة التي وجدتها

المشكلة ليست نقطة واحدة، بل 4 أسباب مترابطة:

1. في `extract-product-info/index.ts` يوجد تعليق يقول:
   - "جرّب Firecrawl HTML أولاً"
   لكن الكود فعلياً يستخدم:
   ```ts
   const htmlForBambuParsing = pageContent;
   ```
   أي أنه **لا يستخدم HTML المRendered** عند تطبيق Bambu parser، لذلك لا يرى صور الـ JP الصحيحة.

2. `parseBambuLabColors` الحالي ضعيف:
   - يستخرج الاسم/الهيكس بـ regexات عامة
   - يربط الصور **بالترتيب فقط**
   - لا يلتقط دائماً **SKU code** مثل `(32300)`
   - لذلك قد ينتج أسماء خاطئة أو بدون كود، وصور `null` أو صور غير مرتبطة فعلاً

3. `retry-extract-colors/index.ts` فيه نفس المشكلة:
   - يبدأ من raw HTML
   - ولا يجلب rendered HTML لـ Bambu بشكل مضمون
   - فيفشل مرة ثانية بنفس الطريقة

4. الواجهة في `AdminCustomRequests.tsx` لا تنفذ replace فعلياً:
   - حتى لو رجعت الدالة `mode: 'replace'`
   - الكود ما زال يعمل merge مع الألوان القديمة
   - لذلك تبقى الأسماء/الصور الخاطئة القديمة ظاهرة وكأن الإصلاح "لم يعمل"

## ما سأصلحه

### 1) إصلاح مصدر HTML في استخراج Bambu
في `supabase/functions/extract-product-info/index.ts` سأعدل التدفق بحيث:
- يتم حفظ `renderedHtml` من Firecrawl في متغير متاح لاحقاً
- parser الخاص بـ Bambu يستخدم:
  ```ts
  renderedHtml || pageContent
  ```
  بدل `pageContent` فقط

هذا هو السبب الأهم وراء أن الصور الصحيحة لا تُلتقط حالياً.

### 2) تقوية `parseBambuLabColors`
سأعيد بناء parser ليكون deterministic بشكل أقوى، وليس regex عام فقط:

- استخراج كل صف لون من نفس block / table / rendered content
- التقاط:
  - الاسم الإنجليزي
  - `hex_code`
  - `SKU/code` مثل `32300`
  - الصورة المرتبطة بهذا اللون
- تكوين الاسم النهائي بهذا الشكل:
  - `Translucent Orange (32300)`

وسأعطي أولوية لربط الصورة عبر:
1. نفس block / نفس variant data
2. اسم الملف أو alt/label مثل:
   - `trans orange`
   - `translucent orange`
3. ثم fallback بالترتيب فقط إذا كان الربط من المصدر واضحاً وعدد الألوان مطابقاً

### 3) منع الصور غير التابعة للون
سأضيف فلترة أقوى بحيث لا تُقبل صورة اللون إلا إذا كانت مرتبطة فعلاً باللون، وليس فقط موجودة داخل الصفحة.

هذا سيمنع:
- الصور العامة
- الصور غير التابعة لنفس اللون
- أي صورة لا تحمل مؤشراً واضحاً مثل filename/label/variant match

### 4) إصلاح retry-extract-colors لنفس منطق Bambu
في `supabase/functions/retry-extract-colors/index.ts` سأطبق نفس الإصلاح:
- جلب rendered HTML لـ Bambu بشكل صريح
- تشغيل نفس parser القوي
- إرجاع بيانات الألوان الصحيحة مع `mode: 'replace'`

### 5) جعل replace فعلياً في الواجهة
في `src/components/AdminCustomRequests.tsx` سأغيّر السلوك:
- إذا رجعت الدالة `mode === 'replace'`
- يتم **استبدال قائمة الألوان بالكامل** بالنتيجة الجديدة الموثوقة
- وليس merge مع القديم

ولمنع بقاء اسم قديم مثل:
- `Translucent Orange`
مع الاسم الجديد:
- `Translucent Orange (32300)`

سأضيف canonical key للألوان يعتمد على:
- base color name
- SKU إن وجد
مع تسوية الحالات القديمة بدون SKU

## الملفات التي سأعدلها

1. `supabase/functions/extract-product-info/index.ts`
   - استخدام rendered HTML فعلياً
   - إعادة بناء Bambu parser
   - استخراج الاسم + الكود + الهيكس + الصورة من نفس المصدر

2. `supabase/functions/retry-extract-colors/index.ts`
   - نفس parser ونفس منطق rendered HTML
   - نفس قواعد replace

3. `src/components/AdminCustomRequests.tsx`
   - replace حقيقي بدل merge
   - canonical normalization لمنع بقاء الأسماء/الصور القديمة

## النتيجة المتوقعة بعد التنفيذ

- الصور الصحيحة المرفقة ستصبح هي المرجع الناتج من الاستخراج
- اسم اللون سيخرج بصيغة صحيحة مثل:
  - `Translucent Orange (32300)`
- الصورة ستأتي من ملف اللون نفسه مثل:
  - `trans orange ...`
  وليس من صورة عامة أو لون آخر
- إعادة الاستخراج ستصحح البيانات القديمة فعلاً، ولن تُبقي النسخ الخاطئة

## التحقق بعد التنفيذ

بعد الموافقة سأتحقق على رابط:
- `https://us.store.bambulab.com/products/petg-translucent`

وسأتأكد من 3 أشياء:
1. parser يلتقط صور JP الصحيحة بدل `0 JP variant images`
2. الاسم يخرج مع SKU مثل `Translucent Orange (32300)`
3. replace يزيل القيم الخاطئة القديمة بدل إبقائها في المنتج
