

# Fix: التحقق من صحة صور الألوان (Image URL Validation)

## المشكلة

الذكاء الاصطناعي يختلق (يهلوس) روابط صور غير موجودة للألوان. مثلاً يعطي رابط صورة لـ "Translucent Orange" لكن الرابط غير حقيقي أو يشير لصورة لون آخر. السبب: الـ HTML من Firecrawl يحتوي على صور المنتج لكن ليس بالضرورة صورة مخصصة لكل لون، والذكاء الاصطناعي يخترع روابط.

أيضاً Bambu Lab API (`/api/spu/product`) أصبحت تُرجع صفحة خطأ HTML بدلاً من JSON — لذا لا يمكن الاعتماد عليها.

## الحل

### 1. التحقق من صحة روابط الصور (Image URL Validation)

في كل من `extract-product-info` و `retry-extract-colors`:
- بعد استخراج الألوان من الذكاء الاصطناعي، **جمع كل الروابط الموجودة فعلياً في HTML** (من Firecrawl أو الصفحة الأصلية)
- لكل لون، التحقق أن `image_url` المعطاة من AI **موجودة فعلاً** في HTML المصدر
- إذا الرابط **غير موجود** في HTML → تعيينها إلى `null` (بدلاً من استخدام رابط مهلوس)
- هذا يمنع الصور الخاطئة من الظهور

```ts
// جمع كل الروابط الموجودة في HTML
const allUrlsInHtml = new Set<string>();
const urlRegex = /https?:\/\/[^\s"'<>]+/gi;
let urlMatch;
while ((urlMatch = urlRegex.exec(renderedHtml)) !== null) {
  allUrlsInHtml.add(urlMatch[0].split('?')[0]); // بدون query params
}

// التحقق من كل image_url
for (const c of colorResult.colors) {
  if (c.image_url) {
    const baseUrl = c.image_url.split('?')[0];
    if (!allUrlsInHtml.has(baseUrl)) {
      c.image_url = null; // رابط مهلوس - إزالة
    }
  }
}
```

### 2. نفس التحقق في الاستخراج الأولي (AI extraction)

في معالجة ألوان AI الأولى (سطر 869-873)، نفس المنطق: التحقق أن `image_url` موجود في `pageContent`.

### 3. نفس الإصلاح في `retry-extract-colors/index.ts`

تطبيق نفس التحقق من الصور.

## الملفات المتأثرة
- `supabase/functions/extract-product-info/index.ts` — إضافة validation للصور في الاستخراج الأولي وFirecrawl
- `supabase/functions/retry-extract-colors/index.ts` — نفس validation

