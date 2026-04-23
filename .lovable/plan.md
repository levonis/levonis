

## منع تداخل البروفايل Orb مع الجزيرة عند التمرير

### المشكلة
عند التمرير لأسفل، الجزيرة تتمدد من حالة `promo` (280px) إلى حالة `search` (360px)، فتتداخل بصرياً مع الـ Profile Orb المثبت في `top-3 left-3` (أو `right-3` في RTL) — يبدو وكأن الـ Orb "يندمج" داخل الجزيرة.

### الحل
الـ Orb يتراجع تلقائياً عندما يبدأ المستخدم بالتمرير، بحيث تأخذ الجزيرة مساحتها الكاملة بدون تصادم بصري، ويعود فوراً عند العودة للأعلى.

### التغييرات (`src/components/ProfileOrb.tsx`)

1. **مراقبة التمرير**: إضافة `useEffect` يستمع إلى `window.scroll` (passive) ويُحدّث state محلي `scrolled` عند تجاوز 40px (نفس عتبة الجزيرة في `IslandContext`).

2. **تأثير الانكماش والاختفاء**:
   - عند `scrolled === true`:
     - الـ Orb يتقلص (`scale-75`) ويتحرك خارجياً قليلاً (translate نحو الحافة + للأعلى).
     - الـ opacity ينخفض إلى 0 ويصبح `pointer-events-none`.
   - عند `scrolled === false`: يعود لحالته الأصلية بنفس spring/transition.

3. **انتقال ناعم**: استخدام `transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]` على transform/opacity.

4. **تحديث الـ origin**: استدعاء `remeasureOrigin()` عند تغيير حالة `scrolled` كي لا يتأثر مركز clip-path عند الضغط.

### ملاحظات
- لا تغيير في الـ Shell أو Provider.
- يحترم RTL (الانزياح نحو الحافة الصحيحة).
- لا تأثير على الصفحات التي يكون فيها الـ Orb مخفياً أصلاً (`/games`, `/community/reels`, `/profile`).

### الملف المعدّل
- `src/components/ProfileOrb.tsx`

