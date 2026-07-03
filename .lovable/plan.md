# خطة إصلاح تقرير التدقيق الكامل (12 بند)

سنعمل على مراحل. كل مرحلة قابلة للنشر بمفردها ونقيس الأثر قبل الانتقال للتالية.

---

## المرحلة 1 — مكاسب الأداء السريعة (يوم واحد)

### 1.1 تفكيك vendor mega-chunk (§3.1) — أكبر مكسب
**الملف:** `vite.config.ts`
- استثناء المكتبات الثقيلة اللازلي-فقط من `manualChunks` (إرجاع `undefined`) حتى يضعها Rollup داخل الـ chunks غير المتزامنة التي تستوردها:
  - `three`, `three-stdlib`, `three-mesh-bvh`, `@react-three/*`
  - `jspdf`, `html2canvas`, `html5-qrcode`
  - `recharts`, `d3-*`
  - `react-image-crop`, `embla-carousel*`, `qrcode.react`
- الإبقاء على `react-vendor` كما هو للمكتبات الأساسية.
- **اختبار:** `npx vite-bundle-visualizer` للتأكد أن `three` ظهر فقط في chunks الألعاب/STL. ثم اختبار المستخدم على iOS Safari قبل النشر (لتفادي مشكلة TDZ السابقة).

### 1.2 إصلاح تحميل صورة LCP مزدوج (§3.2)
**الملفات:** `index.html`, `src/components/banner/BannerImage.tsx` (أو ما يعادله)
- الحل البسيط الآمن: توحيد ثوابت الصورة بين preload في `index.html` و `<picture>` في المكوّن — نفس `format=avif, quality=62, width=800`.
- ترميز URL للـ REST prefetch بنفس طريقة `URLSearchParams` (نستخدم `encodeURIComponent` على مكوّنات `or=(...)`)
- حذف `<link rel=preload>` runtime المكرّر داخل `BannerImage`.
- إذا احتجنا AVIF+WebP: نعتمد AVIF فقط للـ preload (95% من المتصفحات).

### 1.3 حذف الأوزان الميتة (§4.1)
- إزالة تبعيات `mapbox-gl` و `fflate` من `package.json` (غير مستوردة).
- حذف مجلد `src/assets/fonts/` (TTFs غير مستعملة).
- حذف ملفات Cairo woff2 غير المستعملة من `public/fonts/` (الإبقاء على 400/700/900 فقط).
- حذف lockfiles إضافية والإبقاء على `bun.lock` فقط (المشروع يستخدم bun).
- تحويل sprites الألعاب من PNG إلى WebP باستخدام `sharp` (يبقى داخل chunks الألعاب اللازلي).

---

## المرحلة 2 — قابلية التوسّع والاستعلامات (1-2 يوم)

### 2.1 pagination للمنتجات (§3.3)
**الملفات:** `src/pages/CategoryDetail.tsx`, `src/pages/ProductShop.tsx`, `src/pages/SearchResults.tsx`
- استبدال `useQuery` بـ `useInfiniteQuery` مع `.range(page*24, page*24+23)`.
- `IntersectionObserver` sentinel لتحميل الصفحة التالية تلقائياً (استخدام نمط `ProgressiveSection` الموجود).

### 2.2 تقليل `select('*')` (§4.2)
- الأولوية: `BannerCarousel` (LCP)، ثم جميع استعلامات القوائم فوق الطيّ.
- تحديد أعمدة صريحة (`id, name_ar/en/ku, price, image_url, ...`).
- 273 موقع — نعالج الحرج فقط في هذه المرحلة (~30 استعلام رئيسي).

### 2.3 dynamic-import لـ `draftExport.ts` (§4.3)
- تحويل `import jsPDF from 'jspdf'` إلى `const { default: jsPDF } = await import('jspdf')` داخل الدالة المستخدمة.

---

## المرحلة 3 — الأمان (نصف يوم)

### 3.1 CSP و .env (§3.4)
**الملف:** `index.html`, `.gitignore`
- إزالة `'unsafe-eval'` من CSP بعد التأكد من عدم حاجة Meta Pixel/Lovable tagger له في الإنتاج.
- إضافة `.env` إلى `.gitignore` وإنشاء `.env.example`.
- (لا نلمس Anon key — عام بالتصميم عندما تكون RLS محكمة).

---

## المرحلة 4 — تجربة الاستخدام المتكررة (يوم + رولّ آوت مرحلي)

### 4.1 Service Worker جديد بـ Workbox (§4.6)
- تثبيت `vite-plugin-pwa` مع `generateSW`.
- `NetworkFirst` للـ navigations (يمنع stale-screen).
- `CacheFirst` للأصول ذات hashes والخطوط.
- إبقاء kill-switch script الحالي دورة إصدار واحدة ثم إزالته.
- **الإلزامات المهمة:** يسجّل SW فقط في الإنتاج، ليس في preview/iframe/dev (وفقاً لدليل PWA).

---

## المرحلة 5 — SEO والوصولية (يومان)

### 5.1 OG server-rendered (§4.7)
- توصيل edge function `product-og` الموجودة بطبقة CDN routing:
  - crawler user-agents لمسارات `/product/:slug`, `/category/:slug`, `/s/:slug` تحصل على HTML بـ OG tags مضمّنة.
- توجيه `robots.txt` إلى edge function `sitemap` بدلاً من `public/sitemap.xml` الثابت.

### 5.2 تحسينات a11y (§6)
- إضافة `eslint-plugin-jsx-a11y` + إصلاح تحذيراته آلياً حيث أمكن.
- `alt` لكل `<img>` (product name أو `""` للزخرفية).
- `aria-label` لكل button icon-only.
- pause-on-focus + `prefers-reduced-motion` في `BannerCarousel` و framer-motion (wrapper واحد).

---

## المرحلة 6 — الصيانة وأداء الجداول الكبيرة (2-3 أيام)

### 6.1 تقسيم الملفات الضخمة (§4.5)
- `src/pages/Admin.tsx` (4,947 سطر): كل tab في مكوّن منفصل lazy-imported.
- `src/pages/Cart.tsx` (4,294 سطر): استخراج AddressSection, PaymentSection, CouponLogic, SummarySection.
- `src/hooks/useCart.tsx`: استخراج pure functions إلى `src/lib/`.

### 6.2 Virtualization للقوائم الطويلة (§4.4)
- تثبيت `@tanstack/react-virtual`.
- تطبيق على: `AdminOrders.tsx`, `AdminInventory.tsx`, chat messages, notifications, product grids.

---

## المرحلة 7 — اختبارات دخانية (يومان)

### 7.1 Playwright smoke tests (§7)
- 5 تدفقات حرجة:
  1. تصفّح → منتج → إضافة للسلة → checkout
  2. تسجيل الدخول
  3. تتبع الطلب
  4. شحن المحفظة
  5. إتمام طلب من الأدمن

---

## قرارات مهمة

- **iOS Safari:** ستختبر بنفسك بعد المرحلة 1 قبل النشر (كما أكدت).
- **SW rollout:** مرحلي — نبقي kill-switch دورة واحدة قبل الاعتماد الكامل.
- **select('*'):** نعالج الحرج فقط الآن (~30 استعلام)؛ الباقي ندرجه في backlog تدريجي.
- **squash migrations:** خارج النطاق الآن (764 migration) — نتعامل مع db lint فقط للجداول الحساسة (wallet/orders/cards).

---

## ملفات ستُعدَّل أو تُنشأ (المرحلة 1 فقط للبدء)

**مُعدَّلة:**
- `vite.config.ts` — manualChunks
- `index.html` — preload URL + CSP + REST encoding
- `src/components/banner/BannerImage.tsx` — إزالة runtime preload
- `package.json` — حذف mapbox-gl, fflate
- `.gitignore` — إضافة .env

**محذوفة:**
- `src/assets/fonts/*.ttf`
- `public/fonts/cairo-{200,300,500,600,800}.woff2`
- `bun.lockb`, `package-lock.json` (الإبقاء على `bun.lock`)

**جديدة:**
- `.env.example`

---

## البدء

سأنفّذ **المرحلة 1** كاملة في الجولة الأولى بعد الموافقة (أكبر أثر، أقل مخاطرة، قابلة للاختبار فوراً على iOS). بعدها ننتقل للمرحلة 2 إلخ. هل تريد تعديل الترتيب أو استبعاد بند؟