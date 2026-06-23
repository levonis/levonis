# المرحلة 6 — تحسينات قوية وجذرية للأداء على الموبايل

التحسينات السابقة كانت تدريجية. هذه المرحلة جذرية: نقطع كل ما يستهلك CPU/شبكة على الموبايل في أول 3 ثوانٍ، ونؤجل أو نحذف ما لا يُرى في الشاشة الأولى.

## 1. حذف الفيديو نهائياً من الشاشة الأولى على الموبايل

- `CategoryCard.tsx` و `ReelsBar.tsx`: على الموبايل، لا نحمّل الفيديو إطلاقاً (نعرض صورة مصغّرة poster فقط). الفيديو يبدأ فقط عند نقر المستخدم. توفير TBT ~400-800ms.
- إزالة كل preload فيديو، autoplay، loop على الموبايل.

## 2. تقسيم Home.tsx بشكل عدواني (Code Splitting)

- كل قسم تحت الـ fold الأول يصبح `React.lazy()` ملفوف بـ `ProgressiveSection`.
- الأقسام: Reels، Categories السفلية، Featured، Stories، Community Teaser، Games Teaser، Footer — كلها lazy.
- النتيجة: bundle أولي ~40-50% أصغر.

## 3. حذف Framer Motion من المسار الحرج

- `Home`, `AppNavBar`, `CategoryCard`, `PageLoader` → CSS transitions/keyframes فقط.
- framer-motion يبقى فقط داخل المسارات الثقيلة (Reels page، Games، Dialogs) المحمّلة كسولاً.
- توفير ~50KB gzip من main bundle.

## 4. LCP Image: preload صريح + AVIF

- `index.html`: إضافة `<link rel="preload" as="image" fetchpriority="high">` لأول صورة hero/banner (نستخرج URL من Supabase storage).
- استخدام `?format=avif` مع `<picture>` fallback إلى WebP.
- خفض جودة الصور المصغّرة من 65→55 على الشاشات <480px.

## 5. تعطيل backdrop-filter على الموبايل ضعيف الأداء

- `index.css`: على `(max-width: 768px) and (max-device-memory: 4gb)` أو `prefers-reduced-motion` → استبدال `backdrop-filter: blur(20px)` بـ `background: rgba(...)` صلب.
- backdrop-filter من أثقل العمليات على GPU في الموبايل.

## 6. Service Worker: precache صدفة التطبيق

- `public/sw.js`: precache لـ `/`, `/assets/index-*.js`, `/assets/index-*.css`, font Cairo subset.
- الزيارة الثانية تفتح فوراً (~200ms FCP بدل ~2s).

## 7. تأجيل كل المراقبات والاشتراكات

- `useOrderRealtimeNotifications`, `useMessageNotifications`, `useOnlineHeartbeat`, `useDailyLogin`, `useNotificationPermission`: كلها خلف `requestIdleCallback(timeout: 3000)` بعد التحميل الأول.
- realtime channels لا تُفتح إلا بعد `load` + idle.

## 8. تحجيم العناصر مسبقاً (CLS = 0)

- تثبيت `aspect-ratio` و `min-height` على: بطاقات الفئات، Reels، Banner، Nav، Dynamic Island، Hero قبل hydration.
- استبدال `PageLoader` الحالي (دوائر متحركة) بـ skeleton ثابت بنفس أبعاد المحتوى النهائي.

## 9. خفض react-query polling/refetch

- `staleTime` افتراضي 5 دقائق على Home.
- `refetchOnWindowFocus: false` على المسار الحرج.
- إلغاء أي `refetchInterval` < 60s على الشاشة الأولى.

## 10. Cache headers صارمة

- `public/_headers`: `Cache-Control: public, max-age=31536000, immutable` لـ `/assets/*`، و `stale-while-revalidate=86400` لـ HTML.

## الملفات المتأثرة

```text
index.html
vite.config.ts
public/sw.js
public/_headers
src/index.css
src/main.tsx
src/pages/Home.tsx
src/components/CategoryCard.tsx
src/components/reels/ReelsBar.tsx
src/components/AppNavBar.tsx
src/components/ui/PageLoader.tsx
src/components/ProgressiveSection.tsx
src/components/OptimizedImage.tsx
src/hooks/useOrderRealtimeNotifications.tsx
src/hooks/useMessageNotifications.ts
src/hooks/useOnlineHeartbeat.ts
src/hooks/useDailyLogin.tsx
```

## ما لن يتغيّر

- لا تعديل على منطق الأعمال، Supabase schema، RLS، Cart، Checkout، Auth.
- framer-motion يبقى في Reels/Games/Dialogs.
- التصميم البصري نفسه (Glassmorphism) — فقط على الموبايل الضعيف يصبح صلباً بدل blur.

## المتوقع بعد التطبيق

- LCP: 4.5s → ~2.0s
- TBT: 600ms → ~150ms
- INP: تحسّن ملحوظ على النقر/التمرير
- CLS: ~0

هل أبدأ التنفيذ؟