

## تنظيف الـ imports غير المستخدمة في `Home.tsx`

### العناصر التي أصبحت غير مستخدمة بعد إزالة `CommunitySection`
- `AnimatedDivider` (سطر 11) — كان فقط للفاصل أعلى قسم المجتمع.
- `ErrorBoundaryFallback` (الكلاس، أسطر 22–30) — كان يلفّ `<CommunitySection />` فقط.
- نتيجة لذلك: `Component` و`ReactNode` من `react` (سطر 1) لا تُستخدم في أي مكان آخر.

### التغييرات (`src/pages/Home.tsx`)

1. سطر 1 — تقليص استيراد React:
   - من: `import { useMemo, lazy, Suspense, memo, Component, ReactNode } from 'react';`
   - إلى: `import { useMemo, lazy, Suspense, memo } from 'react';`

2. سطر 11 — حذف:
   ```
   import AnimatedDivider from '@/components/ui/animated-divider';
   ```

3. أسطر 22–30 — حذف كلاس `ErrorBoundaryFallback` بالكامل (التعليق التمهيدي + الكلاس).

### يبقى كما هو
- `useMemo`, `lazy`, `Suspense`, `memo` — كلها لا تزال مستخدمة.
- باقي الأقسام والمكونات (`StoriesBar`, `BundlesSection`, `ReelsBar`, `OffersStorageSection`, `BannerCarousel`, `CategoryCard`, `Footer`, `ProgressiveSection`) دون تغيير.

### الأثر
- إزالة dependency على `animated-divider` من حزمة الصفحة الرئيسية.
- إزالة كود الـ Error Boundary غير المستخدم (~9 أسطر) → حزمة Home أصغر.

### الملف المعدّل
- `src/pages/Home.tsx`

