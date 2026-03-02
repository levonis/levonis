

## خطة تحسين سرعة تحميل الصفحة واستجابة الموقع

### الملاحظات والمشاكل المكتشفة

1. **خطأ `fetchPriority` في BannerCarousel** — React 18 لا يدعم `fetchPriority` كـ prop مباشر على `<img>` (يظهر في Console كتحذير). يجب استخدام الكتابة الصغيرة `fetchpriority` أو إزالته.

2. **BannerCarousel progress timer مكثف** — `setInterval` كل 50ms يسبب 20 تحديث state/ثانية (re-renders مستمرة). يمكن استبداله بـ CSS animation للـ progress bar.

3. **CategoryDetail يجلب `select('*')` للمنتجات** — يجلب كل الأعمدة بما فيها `colors` (JSON كبير جداً كما يظهر في الـ network). يجب تحديد الأعمدة المطلوبة فقط.

4. **Home page: استعلام `direct-sale-categories-v2` بـ `staleTime: 0`** — يعيد الجلب في كل مرة. يمكن رفعه إلى دقيقة واحدة على الأقل.

5. **AnnouncementBar: `refetchInterval: 120000`** — مقبول لكن يمكن تحسين الأداء بإضافة `refetchOnWindowFocus: false`.

6. **Service Worker فارغ عملياً** — لا يخزّن أي assets مؤقتاً (الـ fetch handler لا يفعل شيئاً). يمكن إضافة تخزين مؤقت للـ static assets.

### التحسينات المقترحة

#### 1. إصلاح خطأ `fetchPriority` في BannerCarousel
- **الملف**: `src/components/BannerCarousel.tsx`
- إزالة `fetchPriority` prop من `<img>` واستخدام `link preload` فقط (موجود بالفعل)

#### 2. استبدال progress timer بـ CSS animation
- **الملف**: `src/components/BannerCarousel.tsx`
- استبدال `setInterval` كل 50ms بـ CSS `@keyframes` + `animation-duration: 5s` لشريط التقدم
- تقليل re-renders من ~20/ثانية إلى 0 أثناء التشغيل التلقائي
- استخدام `setTimeout` واحد فقط للانتقال بين البانرات

#### 3. تحسين استعلام المنتجات في CategoryDetail
- **الملف**: `src/pages/CategoryDetail.tsx`
- تغيير `select('*')` إلى `select('id, name, name_ar, description_ar, price, original_price, image_url, images, currency, slug, has_in_stock, sold_count, in_stock, is_pricing_updated, direct_stock, colors')` لتقليل حجم البيانات
- إضافة `staleTime: 2 * 60 * 1000` لتقليل الاستعلامات المتكررة

#### 4. تحسين staleTime لاستعلام البيع المباشر
- **الملف**: `src/pages/Home.tsx`
- رفع `staleTime` من `0` إلى `60 * 1000` (دقيقة واحدة) لـ `direct-sale-categories-v2`

#### 5. تفعيل التخزين المؤقت في Service Worker
- **الملف**: `public/sw.js`
- إضافة استراتيجية cache-first للملفات الثابتة (JS, CSS, fonts, images)
- استراتيجية network-first للـ HTML

#### 6. تحسينات CSS طفيفة
- **الملف**: `src/index.css`
- إضافة `content-visibility: auto` للأقسام أسفل الصفحة (CommunitySection, OffersStorageSection) لتأجيل رسمها

### الملفات المتأثرة
- `src/components/BannerCarousel.tsx`
- `src/pages/CategoryDetail.tsx`
- `src/pages/Home.tsx`
- `public/sw.js`
- `src/index.css`

