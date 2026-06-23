# المرحلة 5 — تحسينات جذرية للسلاسة والاستجابة

تركيز هذه المرحلة على تقليل **TBT** (Total Blocking Time) و **INP** (Interaction to Next Paint) و **LCP** بشكل ملحوظ، لأن هذه هي المقاييس التي تُسقط درجة الموبايل في تقرير PageSpeed الحالي.

## 1. تقليل JavaScript على الصفحة الرئيسية (الأثر الأكبر)

- **تأجيل `ReelsBar` و `CategoryCard` فيديو** خلف `IntersectionObserver` صارم + `requestIdleCallback`، مع إيقاف التحميل تماماً على الـ Data Saver وعلى الشبكات `2g/slow-2g` (عبر `navigator.connection`).
- **إزالة `framer-motion` من المسار الحرج للهوم** عبر استبدال الحركات البسيطة (fade/slide) بـ CSS transitions، وإبقاء framer-motion فقط للصفحات الثقيلة (Reels, Games).
- **تقسيم `Home.tsx`** إلى أقسام `lazy()` مغلفة بـ `ProgressiveSection` بحيث لا يُحمَّل أي قسم تحت الطية حتى يقترب المستخدم منه.

## 2. تقليل Main-Thread Work

- **Web Worker** لأي parsing/format ثقيل يتم حالياً على الـ main thread (مثلاً تحويلات الأسعار الكثيرة في `cardPrice.ts` عند عرض شبكة منتجات كبيرة) — أو على الأقل `useDeferredValue` + `useTransition` حول الـ filtering/sorting.
- **`scheduler.postTask`** (مع polyfill بسيط) لجدولة مهام الـ prefetching و analytics في `priority: 'background'`.
- **إلغاء `MutationObserver` الواسع في `ImageQualityBoost`** على body كله — استبداله بنسخة مُحدودة (يراقب فقط الحاويات الحرجة) أو الاكتفاء بـ CSS attribute selector + loading="lazy" افتراضياً في build step.

## 3. CLS = 0 على الهوم

- تثبيت `aspect-ratio` و `min-height` على: بطاقات الـ Reels، بطاقات الفئات، البانر، شريط التنقل، والـ DynamicIsland قبل الـ hydration.
- استبدال `PageLoader` الحالي بـ skeleton متطابق الأبعاد مع المحتوى النهائي (نفس المقاسات بالضبط) لتجنب أي قفزة عند انتهاء التحميل.

## 4. الشبكة و الـ Caching

- **تفعيل `<link rel="preconnect">`** لـ Supabase storage و CDN الصور في `index.html`.
- **`Cache-Control: public, max-age=31536000, immutable`** عبر `public/_headers` لكل ملفات `/assets/` (Vite hashed).
- **Service Worker**: تحديث استراتيجية الـ runtime caching للصور إلى `stale-while-revalidate` مع حد أقصى 200 صورة، وإضافة precache للـ critical CSS و الـ font subset.

## 5. الصور (LCP)

- **Hero/Banner الرئيسي**: إضافة `<link rel="preload" as="image" imagesrcset="..." fetchpriority="high">` في `index.html` للصورة LCP بصيغة AVIF/WebP.
- **خفض جودة الـ thumbnails** في `OptimizedImage` من 75 إلى 65 (فرق بصري شبه معدوم على الموبايل، توفير ~20% bytes).
- **منع تحميل srcSet كامل** على شاشات < 400px — اكتفاء بـ width 200/400 فقط.

## 6. تحسينات micro-INP

- **`pointer-events: none`** على عناصر الزخرفة (glow, particles) في كل مكان لمنع hit-testing zaman.
- **passive listeners** على كل `touchstart/wheel/scroll` الحالية (مراجعة شاملة سريعة).
- **`content-visibility: auto`** على كل قسم تحت الطية في `Home`, `RewardsHub`, `MiniGames`.

## الملفات المتوقع تعديلها

`index.html` · `vite.config.ts` · `public/_headers` · `public/sw.js` · `src/main.tsx` · `src/pages/Home.tsx` · `src/components/CategoryCard.tsx` · `src/components/reels/ReelsBar.tsx` · `src/components/ImageQualityBoost.tsx` · `src/components/OptimizedImage.tsx` · `src/components/ProgressiveSection.tsx` · `src/components/ui/PageLoader.tsx`

## خارج النطاق

- لا تغييرات على منطق الـ business (cart, pricing, orders).
- لا تغيير على framer-motion في صفحات Games/Reels.
- لا تغيير على Supabase queries أو RLS.

## المخاطر

- تقسيم `Home.tsx` بـ lazy قد يُظهر skeletons أكثر مما يعتاد المستخدم — سنضمن أبعاداً مطابقة لتجنب أي إحساس بالقفز.
- تخفيض جودة الصور من 75→65: سنراجع بصرياً قبل النشر.
