
## استبدال `lazy/Suspense` غير الضروري في `Home.tsx` باستيراد مباشر

### المنطق
- الأقسام داخل `ProgressiveSection` (تنتظر الـ viewport) تستفيد فعلياً من الـ lazy → تبقى كما هي.
- الأقسام الظاهرة فوراً أعلى الصفحة لا فائدة من تأجيلها — `Suspense` يُسبب وميض fallback ويزيد عدد الـ chunks.

### يبقى lazy (مبرر)
- `BundlesSection` — داخل `ProgressiveSection`.
- `OffersStorageSection` — داخل `ProgressiveSection`.

### يتحول إلى استيراد مباشر
- `ReelsBar` — مباشرة بعد البانر، above-the-fold، بدون `ProgressiveSection`.
- `StoriesBar` — بعد قسم الـ Hero، above-the-fold، بدون `ProgressiveSection`.

### التغييرات (`src/pages/Home.tsx`)

1. حذف السطرين:
   ```ts
   const StoriesBar = lazy(() => import('@/components/stories/StoriesBar'));
   const ReelsBar = lazy(() => import('@/components/reels/ReelsBar'));
   ```
   وإضافتهما كـ imports مباشرة بجانب `BannerCarousel`:
   ```ts
   import StoriesBar from '@/components/stories/StoriesBar';
   import ReelsBar from '@/components/reels/ReelsBar';
   ```

2. إزالة غلاف `<Suspense fallback=...>` حول `<ReelsBar />` و`<StoriesBar />` في الـ JSX، وعرض المكوّن مباشرة داخل الـ `<section>`.

3. `Suspense` و`lazy` يبقيان في استيراد React (لا يزالان مستخدمين لـ `BundlesSection`/`OffersStorageSection`).

### بدون تغييرات
- بنية الأقسام، الترتيب، التنسيقات.
- منطق `ProgressiveSection`.
- باقي الـ imports.

### الأثر
- إزالة وميض الـ Suspense fallback أعلى الصفحة.
- تقليل عدد الـ chunks بـ 2.
- الأقسام الفعلية أسفل الصفحة تبقى كسولة كما يجب.

### الملف المعدّل
- `src/pages/Home.tsx`
