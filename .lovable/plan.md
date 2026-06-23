## المرحلة 2 — تقليل حجم JS وتسريع التنقل

بناءً على تشخيص المرحلة 1 (Core Web Vitals: فشل)، الأسباب الجذرية الرئيسية المتبقية هي:

### الثغرات المكتشفة
1. **framer-motion ضخم (~110KB gzip)** يُحمَّل في الـ initial bundle عبر `DynamicIsland` و`AnimatePresence` — يسبب تأخير TBT/INP.
2. **vendor chunks غير منفصلة بالشكل الأمثل** — `@radix-ui`, `framer-motion`, `recharts` تذهب لـ `vendor-react` الضخم.
3. **`IdleRoutePrefetcher` يُحمّل فقط 6 صفحات** — التنقل لـ `ProductDetail`, `CategoryDetail`, `Profile`, `Auth`, `Checkout` يتطلب chunk download.
4. **`PageLoader` يُعرض دائماً 400ms+** حتى لو الصفحة جاهزة — يُبطئ navigation المُدرَك.
5. **`CommunityHome` و pages أخرى ليست `lazy()` بشكل صحيح** أو تُحمّل مع dependencies ثقيلة.
6. **`AppNavBar` يستعلم Supabase فوراً على mount** (`unreadMsgCount`) — يحجز thread أثناء FCP.
7. **`framer-motion` warning في console** (`PopChild ref`) — استخدام مكلف بدون فائدة.

### الإصلاحات

**A. Chunking أذكى في `vite.config.ts`**
- `vendor-framer` منفصل (framer-motion + motion-dom).
- `vendor-radix` منفصل (كل @radix-ui/*).
- `vendor-charts` منفصل (recharts + d3).
- `vendor-router` منفصل (react-router-dom).
- اختبار سريع للتأكد ما يكسر TDZ (إذا كسر، نُعيد للحالة السابقة).

**B. تأجيل framer-motion**
- `DynamicIsland`: استبدال `AnimatePresence` + `motion.div` بـ CSS transition + `animate-fade-in/scale-in` الموجودة في tailwind — نفس التأثير، صفر JS.
- إزالة framer-motion من أي مكون لا يحتاج layout animations معقدة. الإبقاء عليه فقط في الـ reels/games.

**C. توسيع `IdleRoutePrefetcher`**
- إضافة: `ProductShop`, `Favorites`, `Profile`, `Auth`, `Checkout`, `Home` (للعودة من صفحة فرعية).
- استخدام `requestIdleCallback` مع `timeout: 3000` لتجنب التزاحم على CPU.

**D. تأجيل استعلامات `AppNavBar`**
- `unreadMsgCount` لا يُستعلم قبل 2s من mount (idle callback).
- استخدام `staleTime: 60_000` بدل refetch كل 30s (الـ realtime channel موجود أصلاً).

**E. حذف `PageLoader` التعسفي**
- استخدام `<Suspense fallback={null}>` بدل `PageLoader` للـ route transitions (الصفحات تنتقل فوراً عبر prefetch).
- الإبقاء على PageLoader فقط في الـ first paint.

**F. إصلاح تحذير framer-motion**
- إزالة `AnimatePresence` من `DynamicIsland` بعد التحويل لـ CSS — يحل الـ warning تلقائياً.

### الملفات المُعدَّلة
- `vite.config.ts` — manualChunks
- `src/island/DynamicIsland.tsx` — استبدال framer-motion بـ CSS
- `src/components/IdleRoutePrefetcher.tsx` — توسيع
- `src/components/AppNavBar.tsx` — تأجيل query
- `src/App.tsx` — تنظيف Suspense fallbacks

### مخاطر
- تقسيم chunks جديد قد يكسر TDZ → سنختبر build بعد كل تغيير.
- استبدال framer-motion في DynamicIsland قد يفقد transitions ناعمة — CSS سيُحاكيها بنفس المدّة (`220ms cubic-bezier`).
- لن نلمس business logic أو DB.

### قياس النجاح
- تقليل initial JS بـ ~150KB gzip.
- TBT < 200ms، INP < 200ms.
- التنقل بين الصفحات الرئيسية بدون chunk fetch مرئي.

هل أبدأ بالتطبيق؟
