
المستخدم لا يزال يرى شاشة "اتصالك بطيء — جرّب شبكة أخرى ثم اضغط إعادة المحاولة" مع زر إعادة المحاولة. هذه ليست شاشة التحميل العادية — هذه شاشة **Offline/Timeout fallback** تظهر عندما يفشل تحميل أصول JavaScript.

## التشخيص الحقيقي

الإصلاح السابق لـ `vite.config.ts` (فصل jspdf/canvg/pako) صحيح تقنياً، لكن المشكلة الآن **مختلفة**:

1. الصورة تُظهر شاشة Fallback مع نص عربي ("اتصالك بطيء") وزر "إعادة المحاولة" — هذه ليست `PageLoader` الافتراضية، بل شاشة timeout مدمجة في `index.html` أو Service Worker.

2. السبب الأرجح: **Service Worker قديم** مخزّن في متصفح المستخدم يحاول تقديم ملفات chunks قديمة (مثل `vendor-jspdf-DGAuUzlQ.js` المكسور) من الـ cache، ويفشل لأن الملفات الجديدة لها hashes مختلفة (مثلاً `vendor-jspdf-XYZ.js`). النتيجة: المتصفح يطلب ملفاً غير موجود → timeout → شاشة "اتصالك بطيء".

3. حتى في Incognito قد تظهر إذا كان `index.html` يُحمّل من cache CDN قديم يشير لـ chunks لم تعد موجودة.

## خطة الإصلاح (طبقتان)

### الطبقة 1: تحديث Service Worker ليُنظّف الـ caches القديمة فوراً
- في `public/sw.js` (أو حيث يُسجَّل): رفع رقم الإصدار، استدعاء `self.skipWaiting()` و `clients.claim()`، وحذف كل الـ caches القديمة في `activate`.
- إضافة استراتيجية **Network-first لـ `index.html`** بدلاً من cache-first، حتى يحصل المستخدم دائماً على HTML طازج يشير لأحدث chunks.

### الطبقة 2: في `index.html` — إلغاء تسجيل أي SW قديم تلقائياً مرة واحدة
إضافة سكربت inline صغير في `<head>` يكتشف عدم تطابق الإصدار ويُجبر:
```js
// إذا فشل تحميل أي module-script، unregister all SWs + clear caches + reload
```

أو أبسط: bump رقم build عبر query string على module entry لكسر الـ cache.

### الطبقة 3 (تأكيدية): التحقق من شاشة "اتصالك بطيء"
البحث عن المصدر الفعلي لهذا النص في الكود (قد تكون في `index.html` أو في hook offline detection) لفهم متى تظهر بالضبط — هل تظهر بعد timeout على fetch؟ هل تظهر عند `navigator.onLine === false`؟

## الخطوات في وضع التنفيذ

1. **استكشاف**: قراءة `public/sw.js`، `index.html`، والبحث عن نص "اتصالك بطيء" لمعرفة أين يُعرض ولماذا.
2. **إصلاح SW**: تحديث `public/sw.js` — bump `CACHE_VERSION`، حذف caches قديمة في `activate`، network-first لـ HTML.
3. **سكربت Self-heal**: إضافة snippet في `index.html` يلتقط فشل تحميل الـ entry chunk ويُلغي تسجيل SW + يعيد التحميل مرة واحدة.
4. **النشر**: ضغط Update في حوار النشر.

## ملاحظة مهمة
إذا كان رفع الموقع يتم عبر Lovable publish وليس عبر hosting تقليدي، فالـ HTML يُقدَّم من Lovable مباشرة، والمشكلة محصورة في:
- Service Worker قديم في متصفح المستخدم (نُصلحه بـ skipWaiting + claim)
- chunks JS قديمة في Cache API (نُصلحها بحذف caches في activate)

هذه المعالجة تعمل لكل المستخدمين تلقائياً عند أول زيارة بعد النشر — مرة واحدة فقط.

## التأكيد
لن أُجري تعديلات على schema قاعدة البيانات. التغييرات محصورة في `public/sw.js` و `index.html` (سطور قليلة في كل ملف).
