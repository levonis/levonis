# خطة تسريع LEVONIS — 4 مراحل

الهدف: تقليل وقت الفتح الأول إلى < 2s على 4G، وحجم JS الأولي إلى < 250KB gzip، ونقل التنقل بين الصفحات إلى < 300ms.

كل مرحلة مستقلة وقابلة للنشر والتحقق قبل المرحلة التالية. لن أبدأ المرحلة التالية إلا بعد تأكيدك أن الموقع يعمل.

---

## المرحلة 1 — تقليل JS الأولي (آمنة، أكبر مكسب)

**المشكلة:** كل `node_modules` مدمج في chunk واحد عملاق `vendor-react` (~800KB+ gzip) لأن أي تقسيم سابق سبب TDZ. الحل: تقسيم محسوب يحترم ترتيب React.

1. **تقسيم vendor بأمان** في `vite.config.ts`:
   - `vendor-react-core` = react + react-dom + jsx-runtime + scheduler (يُحمَّل أولاً)
   - `vendor-router` = react-router-dom
   - `vendor-query` = @tanstack/* (موجود بالفعل في الصفحة الأولى)
   - `vendor-radix` = @radix-ui/* (يُستخدم في كل مكان)
   - `vendor-motion` = framer-motion (lazy فقط — لا يُستورد في Home)
   - `vendor-icons` = lucide-react
   - باقي ما تبقى → `vendor-misc`
   - الحفاظ على chunks الثقيلة الحالية (three, jspdf, html2canvas, qr, charts) كما هي.
   - **اختبار TDZ**: build + فتح `dist/index.html` في Chrome headless للتأكد من المنت.

2. **حذف imports غير ضرورية من المسار الحرج**:
   - مراجعة `App.tsx` (500 سطر) — التأكد أن `Toaster`, `Sonner`, `TooltipProvider`, `HelmetProvider`, `PersistQueryClient` لا تسحب مكتبات ضخمة.
   - تأجيل `installScrollPerformance` إلى `requestIdleCallback`.
   - تأجيل Capacitor imports إلى بعد المنت (موجود لكن يحدث فوراً).

3. **`drop console` فقط في prod** (موجود) + تفعيل `pure_funcs` لإزالة `console.warn`.

**التحقق:** `bun run build` ثم قراءة حجم `dist/assets/*.js` ومقارنة قبل/بعد. اختبار preview للتأكد من عدم تكرار TDZ.

---

## المرحلة 2 — Service Worker آمن + caching قوي

SW حالياً معطل (kill switch). إعادة تفعيله بنمط آمن:

1. **SW جديد بـ Workbox-style بسيط** (لا workbox dep):
   - `network-first` لـ HTML/`/` (مع fallback لكاش)
   - `cache-first` لـ `/assets/*` (chunks محشّاة بهاش — آمن للأبد)
   - `stale-while-revalidate` للصور Supabase render
   - **بدون** `clients.claim()` أو `skipWaiting()` في activate — التحديث في الخلفية فقط، يُطبَّق عند next navigation.
   - **بدون** force navigate (سبب التوقف السابق).

2. **kill-switch مدمج**: زيارة `/?_swkill=1` تلغي تسجيل SW وتمسح caches — إذا حصل أي بلاء.

3. **تسجيل SW بعد `load` + delay 3s** — لا يتنافس مع render الأولي.

**التحقق:** فتح موقع → عمل reload → التحقق من Network tab أن الـ chunks تُسلَّم من `(ServiceWorker)`. زيارة `_swkill=1` للتأكد من خروج آمن.

---

## المرحلة 3 — صور WebP/AVIF تلقائياً

1. **`<OptimizedImage />` موحّد**:
   - يكتشف URL الصور Supabase ويحوّلها تلقائياً عبر `/storage/v1/render/image/public/...?width=X&quality=72&format=webp` (أو `format=avif` إن دعم المتصفح).
   - يضيف `loading="lazy"` و `decoding="async"` افتراضياً.
   - يدعم `priority` للـ LCP فقط.
   - `srcSet` بـ 400/800/1200 + `sizes`.

2. **استبدال `<img>` التلقائي** في:
   - مكونات بطاقات المنتجات (`ProductCard*`)
   - `BannerImage`
   - `ReelCard` thumbnails
   - صور البروفايل/الـ avatars

3. **صور /public ثابتة** (frames, icons): ترك .svg كما هي، تحويل أي PNG/JPG كبير إلى WebP عبر سكربت بناء `scripts/convert-public-images.mjs` (يولّد .webp بجانب الأصلي).

**التحقق:** Lighthouse mobile قبل/بعد على `/` — متوقع تحسن LCP بـ 30-50%.

---

## المرحلة 4 — تأجيل خطوط/أيقونات/scripts ثالثة

1. **خطوط Cairo**:
   - الإبقاء على preload لـ 400 فقط (موجود).
   - تحويل ttf إلى **woff2** (سكربت بناء) — توفير ~60% حجم.
   - إزالة 900 من المسار الحرج إن لم يُستخدم في FCP.

2. **lucide-react**:
   - فحص imports — إن وُجد `import * as Icons` يُستبدل بـ named imports فقط.
   - إعداد plugin `babel-plugin-transform-imports` ليس ضرورياً مع Vite + tree-shaking إن كانت الـ imports نظيفة.

3. **scripts ثالثة (Meta Pixel)** — موجود بـ delay 1.5s، الإبقاء عليه.

4. **Route prefetch ذكي**:
   - عند hover/focus على Link → prefetch chunk الصفحة (`<link rel="modulepreload">` ديناميكياً).
   - يجعل التنقل فورياً.

**التحقق:** Lighthouse + قياس `transferSize` لـ `/` على Network throttling = "Fast 3G".

---

## التنفيذ

سأبدأ المرحلة 1 الآن بعد موافقتك على هذه الخطة، ثم أتوقف لأعرض النتائج وأطلب الإذن قبل المرحلة 2.

## تفاصيل تقنية

- **TDZ guard**: قبل ai chunk split، قراءة كل libs كبيرة في `node_modules` للتحقق من `import React from 'react'` على المستوى الأعلى. أي lib تستورد React تبقى مع `vendor-react-core` أو في chunk يُحمَّل بعدها بترتيب صريح.
- **ترتيب الـ chunks**: Vite يضمن ترتيب التحميل عبر `<link rel="modulepreload">` المولّدة في `index.html` بشرط عدم تجاوزها يدوياً.
- **SW versioning**: `CACHE_NAME = 'levonis-v17'` بعد إعادة التفعيل، مع تنظيف v16 وما قبل.
- **Rollback**: كل مرحلة في commit منفصل قابل للرجوع عبر "Restore" في Lovable.
