
## الخلاصة

المشكلة ليست فقط أن الذكاء الاصطناعي “يخترع” الصور، بل أن منطق الاستخراج الحالي لا يبني **ربطًا حقيقيًا** بين اللون وصورته. هو يكتفي بأن الصورة موجودة في الصفحة، ثم يقبلها، مع أن الصفحة تحتوي أيضًا على صور عرض وزخارف وصور lifestyle مثل `Banner`, `Vase`, `Flower` وغيرها. لذلك قد يختار صورة موجودة فعلًا ولكنها ليست صورة اللون الصحيح.

## السبب الجذري الذي وجدته

1. `extract-product-info/index.ts`
   - التحقق الحالي يفحص فقط: هل `image_url` موجودة في HTML؟
   - هذا لا يثبت أنها تخص نفس اللون.
   - لذلك صور مثل:
     - `JP34951_...jpg`
     - `JP34971_...jpg`
     قد تختلط مع ألوان أخرى أو مع صور gallery عامة.

2. `retry-extract-colors/index.ts`
   - نفس الاعتماد على AI في اختيار `image_url`.
   - وبعدها الواجهة تضيف الألوان الجديدة فقط بدل **تصحيح الألوان الموجودة**.

3. `AdminCustomRequests.tsx`
   - الكود الحالي يعمل merge:
   ```ts
   const updatedColors = [...existingColorsArray, ...data.addedColors];
   ```
   وهذا يعني أن اللون الخاطئ القديم قد يبقى كما هو، أو يتم تكراره بدل استبداله.

4. سجلات الاستخراج تؤكد أن النظام يجلب صورًا كثيرة من `store.bblcdn`، لكنها خليط بين:
   - صور ألوان صحيحة
   - صور بانرات
   - صور lifestyle
   - صور gallery عامة  
   ولا يوجد حاليًا فلتر حاسم يربط كل لون بصورة variant الصحيحة.

---

## ما سأبنيه لحل المشكلة

### 1) إيقاف استخدام AI لتحديد صورة اللون في Bambu Lab
سأحوّل `image_url` في Bambu Lab إلى **استخراج deterministic** بدل الاعتماد على AI.

الفكرة:
- AI يمكنه المساعدة في الاسم/الترجمة/hex عند الحاجة
- لكن **الصورة** ستأتي فقط من parser مخصص يقرأ البيانات المنظمة من الصفحة/المحتوى المعروض

### 2) إضافة parser خاص بـ Bambu Lab لاستخراج ربط اللون ← SKU/code ← image
في `extract-product-info/index.ts` سأضيف منطقًا خاصًا لـ Bambu Lab يقوم بـ:
- فحص `__NEXT_DATA__`
- فحص HTML المعروض من Firecrawl
- البحث عن كتل البيانات التي تحتوي:
  - اسم اللون
  - الكود مثل `32300`
  - swatch/background-color
  - صور المنتج الخاصة بالـ variant
- بناء مصفوفة structured مثل:
```ts
{
  name: "Translucent Orange (32300)",
  hex_code: "#...",
  image_url: "https://store.bblcdn.com/.../JP34951_....jpg"
}
```

### 3) اعتماد صور variant فقط واستبعاد الصور العامة
سأضيف فلترة صارمة للصور في Bambu Lab:
- قبول صور المنتج التي تشبه ملفات variant الحقيقية
- استبعاد الصور التي تدل على بانر/دعاية/استخدامات مثل:
  - `Banner`
  - `Mobile`
  - `Vase`
  - `Flower`
  - `Polar_Bear`
  - `Wave`
  - `Cup`
  - `Wall`
- وإعطاء أولوية للصور التي ترتبط بنفس variant block أو نفس SKU/code.

### 4) جعل اسم اللون إجباريًا مع الكود إذا وُجد
بدل:
- `Translucent Orange`
سيصبح:
- `Translucent Orange (32300)`

وسيتم ذلك من نفس المصدر المنظم، وليس فقط من prompt.

### 5) منع قبول أي صورة لون ما لم تكن مرتبطة باللون نفسه
بدل منطق:
- “الصورة موجودة في الصفحة إذن مقبولة”
سيصبح:
- “الصورة موجودة داخل نفس variant / نفس SKU / نفس color block”
- وإلا يتم تعيين `image_url = null`

### 6) إصلاح retry ليقوم بالتحديث لا الإضافة فقط
في `retry-extract-colors/index.ts` + `AdminCustomRequests.tsx` سأغيّر السلوك من:
- append colors
إلى:
- update/replace by normalized color key

الـ key سيكون مبنيًا على:
- الاسم الإنجليزي بعد normalization
- مع الكود إن وجد بين القوسين  
مثال:
- `translucent orange (32300)`

وبذلك إذا كان اللون موجودًا بصورة خاطئة:
- يتم **استبدال الصورة والـ hex والاسم**
- لا يتم إنشاء نسخة مكررة

### 7) إضافة logging أوضح للتشخيص
سأضيف logs توضح:
- كم variant تم العثور عليه من Bambu parser
- ما هي الألوان التي حصلت على image mapping مؤكد
- ما هي الصور التي تم رفضها ولماذا
- هل تم الاستبدال أو الإضافة

---

## الملفات التي سأعدلها

1. `supabase/functions/extract-product-info/index.ts`
   - إضافة parser مخصص لـ Bambu Lab variant mapping
   - إيقاف اعتماد AI على `image_url` في Bambu
   - ربط الاسم + الكود + hex + الصورة من نفس المصدر
   - فلترة صور الـ gallery العامة

2. `supabase/functions/retry-extract-colors/index.ts`
   - نفس منطق الربط deterministic بدل AI-only
   - إعادة الإرجاع بشكل يسمح بالتحديث لا الإضافة فقط

3. `src/components/AdminCustomRequests.tsx`
   - استبدال merge الحالي بمنطق upsert/replace للألوان الموجودة

## تفاصيل تقنية مختصرة

```text
Bambu rendered data
   -> parse variant blocks
   -> extract:
      color name
      sku/code
      exact swatch hex
      exact variant image
   -> build canonical color key
   -> replace old incorrect color entries
   -> never use unrelated gallery/lifestyle images
```

### قواعد التنفيذ
- إذا وجد parser صورة مرتبطة باللون: تُستخدم مباشرة
- إذا لم يجد parser صورة مؤكدة: `image_url = null`
- لا يُسمح للـ AI بتعيين صورة لون في Bambu Lab بدون دليل بنيوي
- إذا وجد الكود مثل `32300`، يُضاف للاسم دائمًا

## النتيجة المتوقعة بعد التنفيذ

- اللون الأول سيأخذ صورته الصحيحة مثل:
  - `https://store.bblcdn.com/s7/default/9d6c7b93cef74230a6075b81df079696/JP34951_360f550d-25f1-4d47-84cb-0212d548652d.jpg`
- اللون الثاني سيأخذ صورته الصحيحة مثل:
  - `https://store.bblcdn.com/s7/default/1d517c39b3074e7c979abfec8f13b68c/JP34971_66ae3280-57b6-4733-8831-9f628c89b352.jpg`
- الأسماء ستصبح بصيغة:
  - `Translucent Orange (32300)`
- الألوان الخاطئة المخزنة سابقًا سيتم استبدالها بدل تكرارها

## بعد الموافقة على التنفيذ
سأنفذ التعديلات، ثم أختبر الاستخراج على رابط Bambu Lab نفسه، وأتأكد أن الصور الناتجة تطابق الصور المرجعية التي أرسلتها.
