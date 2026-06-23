# خطة تحسين الأداء — تنفيذ تدريجي

سأطبّق التحسينات على **4 مراحل**، كل مرحلة قابلة للنشر والتحقق منها بشكل مستقل قبل الانتقال للتالية.

---

## المرحلة 1 — LCP و FCP (الأهم: التحميل الأول)

**الهدف:** تقليل وقت أول رسم وأكبر عنصر مرئي على الموبايل.

1. **إصلاح `public/_headers`** — استضافة Lovable لا تقرأ هذا الملف. سأنقل التحسينات إلى:
   - `<meta http-equiv="Content-Security-Policy">` للأمان داخل `index.html`.
   - باقي الرؤوس (HSTS/COOP/Permissions) تُضبط على مستوى البنية التحتية وليست بمتناولنا — سأوثّق ذلك وأُزيل الملف المضلّل.
2. **شعار LCP**: إضافة `<link rel="preload" as="image">` لشعار/صورة الـ hero الثابتة (إن وُجدت) بالإضافة إلى البانر الديناميكي الموجود.
3. **تقليل سلسلة الخطوط**: الإبقاء على `cairo-400` فقط في الـ preload، وتأجيل `cairo-700` (يُستعمل في العناوين بعد الـ FCP).
4. **حذف JS غير ضروري في `<head>`**: مراجعة السكربت المضمّن للبانر — تقليله أو تأجيله إذا أمكن.
5. **`AppNavBar` و `AppBackground` وأيقونة `ProfileOrb`**: تأجيلها بعد الـ first paint (`requestIdleCallback`) لإسقاطها من المسار الحرج.

**التحقق:** فتح PageSpeed بعد النشر، مقارنة LCP/FCP.

---

## المرحلة 2 — تقليل حجم الـ JS وتسريع التنقّل

1. **تقسيم vendor chunks إضافية** في `vite.config.ts`:
   - `vendor-three` (three/@react-three) — مُستعمل في صفحة لعبة واحدة فقط.
   - `vendor-mapbox` (mapbox-gl) — صفحة واحدة.
   - `vendor-framer` (framer-motion) — حالياً مدموج مع react.
   - `vendor-radix` (مجموعة @radix-ui الأقل استعمالاً).
2. **استبدال `framer-motion` بـ CSS** في الأماكن البسيطة (DynamicIsland fade/scale، تحوّلات الصفحات) — `framer-motion` ~110KB gzip.
3. **توسيع `IdleRoutePrefetcher`** ليشمل: `ProductDetail`, `CategoryDetail`, `Profile`, `Auth` (الأكثر طلباً بعد الـ Home).
4. **إزالة `console.log` الحيّة المتبقية في prod** (موجودة جزئياً عبر `esbuild.drop`، لكن `useRenderCount` لا تزال نشطة).
5. **مراجعة imports ساكنة لمكتبات ثقيلة** عبر `rg "from \"html2canvas\"|from \"jspdf\"|from \"mapbox\"|from \"three\""` — يجب أن تكون كلها `await import()` داخل دوال فقط.

**التحقق:** `bun run build` + قراءة أحجام chunks، Lighthouse "Unused JavaScript".

---

## المرحلة 3 — استقرار التخطيط (CLS)

1. **حجز أبعاد للصور**: مراجعة `BannerImage`, `ProductCard`, `Avatar` للتأكد من وجود `width/height` أو `aspect-ratio` ثابت قبل تحميل الصورة.
2. **Skeletons بنفس ارتفاع المحتوى النهائي** للأقسام الرئيسية على `Home` (banners, categories, featured products) — يمنع القفز عند تحميل كل قسم.
3. **خطوط**: التأكد أن `Cairo Fallback` المُعرّف في `index.html` يطابق المقاسات (`size-adjust`, `ascent-override`) — إن لزم سأعدّل النِسب.
4. **تثبيت ارتفاع `DynamicIsland` و `AppNavBar`** عبر `min-height` ثابت لتفادي قفز الصفحة بعد الـ hydration.

**التحقق:** Lighthouse CLS < 0.1.

---

## المرحلة 4 — الذاكرة على الموبايل

1. **استخدام `useIsLowEndDevice`** (موجود مسبقاً) لإسقاط:
   - `backdrop-filter` على البطاقات الزجاجية (استبدال بـ `background-color` نصف شفاف).
   - حركات `framer-motion` الطويلة.
   - prefetch routes (إيقافه على low-end).
2. **تنظيف الـ React Query cache على ضغط الذاكرة**: الاستماع لحدث `pagehide` ومسح الـ queries غير المرئية.
3. **`ProgressiveSection`**: تطبيقه على كل أقسام `Home` و `RewardsHub` و `MiniGames` لمنع تحميل DOM ضخم دفعة واحدة.
4. **service worker `public/sw.js`**: مراجعة قواعد الـ cache — لا يجب تخزين JS chunks قديمة بعد deploy جديد (موجود stale-chunk recovery لكن قد يكون متأخراً).

**التحقق:** Chrome DevTools Memory tab + اختبار يدوي على جهاز mid-range.

---

## التفاصيل التقنية

- لا تغييرات في الـ business logic ولا في الـ DB.
- كل التغييرات في: `index.html`, `src/main.tsx`, `src/App.tsx`, `vite.config.ts`, `src/components/*`, `public/sw.js`.
- سأبدأ بـ **المرحلة 1** فور الموافقة وأرفع تقريراً قبل الانتقال للمرحلة 2.

هل أبدأ بالمرحلة 1؟
