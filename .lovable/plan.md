
## خطة تحسين أداء الموقع وتخفيف الضغط

### التحليل الأولي
الموقع كبير جداً (مئات الميزات: ألعاب، مجتمع، إدارة، صيانة...). الضغط يأتي من:
1. **استعلامات قاعدة البيانات الثقيلة** على الصفحة الرئيسية (categories, products, sections...)
2. **Real-time subscriptions** متعددة (cart, notifications, orders) 
3. **حجم Bundle JavaScript** كبير بسبب تحميل المكونات دفعة واحدة
4. **Re-renders** متكررة في بعض المكونات

### المشاكل المعروفة المحتملة
- الاستعلام `direct-sale-categories-v2` يجلب كل المنتجات (`has_in_stock=true`) ثم يفلتر في الكلاينت — مكلف جداً
- `staleTime` قصير في بعض الاستعلامات → إعادة جلب متكررة
- صور بدون lazy loading أو أحجام محددة
- Console.log في الإنتاج
- مكونات ثقيلة (Three.js, html2canvas) تُحمَّل مع الصفحات

### الخطة المقترحة (5 محاور)

**1. تحسين استعلامات الصفحة الرئيسية (الأهم)**
- نقل فلترة `direct-sale-categories` إلى دالة RPC في قاعدة البيانات بدل جلب كل المنتجات للعميل
- زيادة `staleTime` و `gcTime` للبيانات شبه الثابتة (categories, banners, sections) إلى 10-15 دقيقة
- تفعيل `refetchOnWindowFocus: false` بشكل عام في `QueryClient`

**2. Code Splitting أعمق**
- Lazy load: `BannerCarousel`, `ReelsBar`, `StoriesBar`, `BundlesSection` في الصفحة الرئيسية
- Lazy load صفحات الإدارة/الألعاب/الصيانة (إذا لم تكن كذلك)
- فصل مكتبات ثقيلة (`html2canvas`, `jspdf`, `three`, `html5-qrcode`) في chunks منفصلة عبر `vite.config`

**3. تحسين Real-time والـ Polling**
- مراجعة `useCart` real-time: استخدام channel واحد بدل قنوات متعددة
- تقليل `refetchInterval` للـ stock validation من 10s إلى 30s
- إيقاف الـ subscriptions عند `document.hidden`

**4. تحسين الصور والأصول**
- إضافة `loading="lazy"` و `decoding="async"` لكل الصور غير الحرجة
- إضافة `width/height` لمنع layout shift
- Service Worker: تحسين استراتيجية الكاش للصور (stale-while-revalidate)

**5. تنظيف وإصلاح**
- إزالة `console.log` غير الضرورية في الإنتاج (عبر `vite.config` define)
- إصلاح أي memory leaks (event listeners، intervals بدون cleanup)
- Memoize المكونات الثقيلة في القوائم الطويلة

### الملفات المتأثرة
- `src/pages/Home.tsx` — lazy loading، تحسين queries
- `src/App.tsx` أو حيث `QueryClient` — إعدادات افتراضية أفضل
- `src/hooks/useCart.tsx` — تحسين real-time
- `vite.config.ts` — manual chunks، drop console
- `supabase/migrations/...` — RPC جديد لـ direct-sale categories
- مكونات الصور (`CategoryCard`, `BannerCarousel`...) — lazy attrs

### النتيجة المتوقعة
- تقليل وقت التحميل الأولي ~40-50%
- تقليل استهلاك RAM على الموبايل
- تقليل الضغط على قاعدة البيانات (استعلامات أقل وأخف)
- تقليل عدد الـ re-renders

### ما الذي تريد تنفيذه؟
يمكنني تنفيذ الكل دفعة واحدة، أو بدء بالأهم (محور 1 + 2) لأنهما الأعلى أثراً.
