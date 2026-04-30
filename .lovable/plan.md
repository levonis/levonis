# ضغط وتحويل صور الخلفية تلقائياً + مقاسات responsive

## الوضع الحالي
- `handleBackgroundUpload` في `StoreProfileEditor.tsx` يستدعي `compressImage(file, 1600, 0.85)` الذي يُخرج **JPEG فقط** (canvas.toBlob "image/jpeg")، بحجم أقصى 1600px ضلع طويل.
- الصور تُرفع إلى bucket `merchant_stores` ثم تُحفظ كـ public URL.
- `StoreBackgroundLayer` يستخدم URL الخام بدون srcset أو width/dpr-aware sizing.
- يوجد بالفعل `src/lib/imageUtils.ts` فيه `resizeSupabaseImage` (يستخدم `/storage/v1/render/image/public/` مع width/quality) — موجود لكنه غير مستخدم في الخلفية.

## الأهداف
1. **WebP/AVIF تلقائياً عند الرفع** مع fallback ذكي إلى JPEG عند عدم الدعم.
2. **توليد عدة مقاسات** (sm/md/lg/xl) عند العرض عبر Supabase image transforms (لا حاجة لرفع نسخ متعددة).
3. **اختيار المقاس المناسب لكل شاشة** عبر `<img srcset>` أو media-query-based switching داخل `StoreBackgroundLayer`.
4. **تخفيض حجم الرفع الأصلي** بشكل آمن (cap عند 1920px للضلع الأطول).

## التغييرات المقترحة

### 1. أداة جديدة: `src/lib/backgroundImage.ts`
دالتان أساسيتان:

- **`compressBackgroundToBest(file, maxSide=1920)`**: تختار الأفضل من { AVIF → WebP → JPEG } حسب دعم المتصفح:
  - تجرب `canvas.toBlob(_, 'image/avif', 0.6)` أولاً.
  - إن فشلت، تجرب `'image/webp', 0.78`.
  - وإلا fallback `'image/jpeg', 0.85`.
  - تُرجع `{ blob, mime, ext }`.
  - تتعامل مع EXIF orientation عبر createImageBitmap({ imageOrientation: 'from-image' }) عند الإمكان.

- **`pickBackgroundUrl(baseUrl, viewportWidth, dpr)`**: يلفّ `resizeSupabaseImage` ويختار width من جدول snap [640, 960, 1280, 1600, 1920, 2560] بناءً على `viewportWidth * min(dpr, 2)`.

- **`buildBackgroundSrcSet(baseUrl)`**: يُنتج srcset متعدد العرض لاستخدامه في `<img>`.

### 2. تحديث `handleBackgroundUpload` في `StoreProfileEditor.tsx`
- استبدال `compressImage(file, 1600, 0.85)` بـ `compressBackgroundToBest(file, 1920)`.
- استخدام `mime` و `ext` المُرجعة في:
  - اسم المسار: `${user.id}/bg-${Date.now()}.${ext}`
  - `contentType: mime` في `supabase.storage.upload`.
- إظهار حجم الملف الأصلي vs المضغوط في toast (UX).
- التحقق من حد أقصى **5MB** للملف المُدخل (قبل الضغط) لمنع الانهيار.

### 3. تحديث `StoreBackgroundLayer.tsx`
حالياً يطبّق الصورة كـ CSS `background-image: url(...)` — هذا **لا يدعم srcset**. سنحوّل طبقة الـ image إلى `<img>` فعلي مع:
- `loading="eager"` (الخلفية above-the-fold)
- `decoding="async"`
- `fetchPriority="high"` للصورة الأولى
- `srcSet` من `buildBackgroundSrcSet(value)`
- `sizes="100vw"`
- `className="absolute inset-0 w-full h-full object-cover"`
- إبقاء `useDecodedImage` المحسّن لكن يعمل الآن على الـ URL المختار للشاشة الحالية.

أوضاع `color/gradient/glass` تبقى كما هي (CSS فقط).

### 4. تنظيف ملفات قديمة (اختياري لاحقاً)
أي ملفات `.jpg` قديمة في `merchant_stores/{user_id}/bg-*` تبقى صالحة (الـ render endpoint يحوّل لأي تنسيق output). لا حاجة لـ migration.

## نقاط فنية مهمة
- **Supabase Image Transformations** يدعم `format=webp` تلقائياً عبر header `Accept: image/webp` من المتصفح — لذا حتى الصور المرفوعة كـ JPEG ستُقدَّم WebP في المتصفحات الداعمة عبر `/render/image/public/`. الفائدة من رفع AVIF/WebP أصلاً = توفير مساحة التخزين + مصدر أفضل.
- `canvas.toBlob('image/avif')` مدعوم في Chrome 105+ و Edge 105+ فقط، وليس في Safari/Firefox stable. لذا fallback ضروري.
- `image/webp` مدعوم في كل المتصفحات الحديثة (Chrome/Edge/FF/Safari 14+).
- `resizeSupabaseImage` يستخدم `resize=contain`؛ لخلفية تملأ الشاشة نحتاج `resize=cover` أو نتركه contain ونعتمد على `object-fit: cover` في الـ `<img>`. الخيار الأنسب: `object-fit: cover` (يحتفظ بحرية اختيار CSS).

## ملخص الملفات المتأثرة
- جديد: `src/lib/backgroundImage.ts`
- تعديل: `src/components/merchant/StoreProfileEditor.tsx` (دالة `handleBackgroundUpload` فقط)
- تعديل: `src/components/merchant/StoreBackgroundLayer.tsx` (طبقة الـ image تتحول إلى `<img>` مع srcset)
- لا تغيير على قاعدة البيانات.
- لا تغيير على bucket policies.

## النتائج المتوقعة
- صور خلفية أصغر بـ 30–60% (WebP) إلى 60–80% (AVIF) مقابل JPEG الحالي.
- الجوال يحمّل ~960px بدل 1600px → توفير ~40% إضافية على الجوال.
- لا فرق بصري ملحوظ بفضل `object-fit: cover` و quality المعقول.
- لا breaking changes — الصور القديمة المخزّنة كـ JPEG تستمر بالعمل.
