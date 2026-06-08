## المشكلة

الوميض عند أول تحميل/تنقل بين الصفحات سببه تداخل تأثيرين على نفس اللحظة:

1. `RouteAwareSkeleton` يلفّ الـskeleton بـ `animate-in fade-in duration-300` → الـskeleton نفسه يبدأ شفافاً ثم يظهر تدريجياً (300ms).
2. `PageTransition` على المحتوى الحقيقي يستخدم `animate-page-enter` (translateY + opacity 400ms) — معطّل على الموبايل لكن لا يزال نشطاً على الديسكتوب.

النتيجة: في أول 300ms من فتح أي صفحة، الـskeleton يومض من شفاف إلى ظاهر، ثم يُستبدل فجأة بالمحتوى الحقيقي = إحساس بقفزة/وميض.

## الحل

اجعل الـskeleton يظهر فوراً بدون أي fade (هو placeholder، يجب أن يكون موجوداً منذ اللحظة 0)، واترك المحتوى الحقيقي ينزلق بسلاسة فوقه.

### التغييرات

**1. `src/components/RouteAwareSkeleton.tsx`**
- إزالة `<div className="animate-in fade-in duration-300 ease-out">` الذي يلفّ الـskeleton.
- إرجاع الـskeleton مباشرة بدون أي wrapper animation → يظهر فوراً عند suspension بدون وميض.

**2. `src/components/ui/PageTransition.tsx`**
- تخفيف الحركة إلى opacity فقط بدون `translateY` (الـtranslateY يسبب الإحساس بـ"قفزة" خاصة عند الانتقال من skeleton للمحتوى).
- تقليل المدة من 400ms إلى 200ms وتأخير بسيط (0ms) ليبدأ فور mount.

**3. `src/index.css`** (تحديث keyframe `page-enter`)
- تبسيط الـkeyframe: `opacity 0 → 1` فقط، مدة 200ms، easing `ease-out`.
- إبقاء التعطيل على الموبايل كما هو (لا حاجة لأي حركة على الموبايل أصلاً).

### لماذا يحل هذا الومضة

- قبل: skeleton يظهر بـfade 300ms → محتوى يدخل بـtranslateY+fade 400ms = طبقتان متحركتان متتاليتان.
- بعد: skeleton يظهر فوراً (0ms) → محتوى يحلّ محله بـfade خفيف 200ms فقط = انتقال واحد سلس، بدون قفز محور Y، بدون وميض في البداية.

### ما لن يتغير

- منطق `pickSkeleton` (الأشكال الخاصة بكل route تبقى كما هي).
- LQIP blur على الصور كما هو (يعالج وميض الصور، ليس وميض الصفحات).
- آلية stuck recovery في `RouteSuspenseFallback`.
- لا تعديل على أي business logic، DB، أو RLS.

### الملفات المعدّلة

- `src/components/RouteAwareSkeleton.tsx` (سطر واحد: إزالة الـwrapper).
- `src/components/ui/PageTransition.tsx` (تبسيط className/style).
- `src/index.css` (تحديث keyframe `page-enter`).
