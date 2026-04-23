

## إزالة قسم "مجتمع ليفو" من الواجهة الرئيسية

### الهدف
تخفيف عبء التحميل على الصفحة الرئيسية (`Home.tsx`) عبر إزالة قسم `CommunitySection` بالكامل، مع إبقائه متاحاً عبر صفحة `/community`.

### التغييرات (`src/pages/Home.tsx`)

1. **حذف الـ lazy import** الخاص بـ `CommunitySection` (مع كتلة الـ retry-on-failure) — يمنع تحميل أي chunk للمجتمع من الصفحة الرئيسية.
2. **حذف الكتلة المعروضة** في أسفل الصفحة:
   - `AnimatedDivider` التمهيدي،
   - الـ `ProgressiveSection` + `Suspense` + `ErrorBoundaryFallback` المغلِّفة لـ `<CommunitySection />`.
3. **إبقاء** `Footer` في مكانه مباشرة بعد آخر قسم متبقٍّ.

### بدون تغييرات
- `/community` (`CommunityHome`) يبقى كما هو ويعرض المحتوى بشكل كامل.
- لا تأثير على شريط التنقل أو روابط `LevoHelpBot` المؤدية إلى `/community`.
- لا تعديل على بقية أقسام الرئيسية.

### الملف المعدّل
- `src/pages/Home.tsx`

