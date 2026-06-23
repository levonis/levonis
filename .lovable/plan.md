## نتائج المرحلة 2 (Lab — Moto G Power, Slow 4G)

| المقياس | القيمة | الحالة |
|---|---|---|
| Performance | 67 | ⚠️ |
| **LCP** | **5.8s** | ❌ كارثي |
| FCP | 3.8s | ⚠️ |
| TBT | 80ms | ✅ ممتاز (نتيجة المرحلة 2) |
| CLS | 0.017 | ✅ ممتاز |
| CWV الميداني | LCP 3.5s | ❌ فشل |

TBT انخفض لـ 80ms (المرحلة 2 نجحت). الباقي = **LCP فقط**.

## تشخيص LCP

تحليل Lighthouse لعنصر LCP (banner image):

```
TTFB:               0 ms
Resource load delay: 190 ms
Resource load:       100 ms
Element render delay: 2,300 ms  ← المشكلة 96%
```

**الأسباب الجذرية**:

1. **CSS كبير يحجب الـ render لـ 1,590ms** — `index-CeXUVGGO.css` بحجم 45 KiB.
2. **سلسلة 22 chunk متتالية** قبل ظهور البانر (waterfall طويل 3,013ms).
3. **13 MB فيديو يُحمَّل تلقائياً** على الصفحة الرئيسية:
   - `merchant-reels/.../*.mp4` — 5.4 MB + 4.7 MB (ReelsBar — ثمب نيلز فقط مفروض، لكن السيرفر يرجع 2 reels بدون thumbnail فيُحمّل الفيديو كامل)
   - `category-media/*.webm` — 1.77 MB + 1.61 MB (CategoryCard مع `autoPlay` يتجاهل `preload="none"`)
4. **الخطوط بدون Cache-Control** (`cairo-400/700/900.woff2` و `logo-small.webp` و `notification.mp3`) — `public/_headers` لا تطبَّق على دومين Lovable.

## الإصلاحات

### A. كسر سلسلة الـ render (الأهم — يوفر ~1.5s LCP)
- **inline critical CSS** للـ above-the-fold في `index.html` (~3-5 KiB) — يسمح للمتصفح ببدء paint قبل وصول الـ CSS الكامل.
- نقل وسم `<link rel="stylesheet">` للـ CSS الرئيسي إلى أسلوب `preload + onload` (async loading) مع `<noscript>` fallback.
- إضافة `<link rel="preconnect">` للـ Supabase storage (موجود؟ نتحقق ونضيف إذا ناقص).

### B. حذف فيديوهات الـ reels من المسار الحرج (يوفر 9-10 MB)
- `ReelsBar.tsx`: إذا لم يوجد `thumbnail_url`، نعرض placeholder ثابت (gradient + أيقونة Play) بدل تحميل الفيديو كامل. الفيديو يُحمَّل فقط داخل `ReelsFeed` (عند الفتح).
- بديل: إنشاء thumbnail تلقائي على edge function وقت رفع الـ reel — لكن خارج نطاق هذه المرحلة.

### C. تأخير فيديوهات الفئات (يوفر 3.4 MB)
- `CategoryCard.tsx`: إزالة `autoPlay` من الفيديو حتى يتم scroll/hover. عرض الـ poster (image fallback) أولاً، تشغيل الفيديو فقط عند `inView` + بعد `requestIdleCallback`. الـ `media_url` للفيديو يبقى لكن نضيف poster من thumbnail image.
- بديل أبسط (نفضّله): إذا كان `mediaType === 'video'` وكان index ≥ 2 في الـ grid، اعرض image fallback فقط حتى تظهر بطاقة الفئة في الـ viewport لمدة 300ms.

### D. ضغط CSS (يوفر ~1.5s blocking)
- تفعيل `tailwindcss` purge بشكل أصرم (التحقق من content paths).
- استخدام `cssCodeSplit: true` في `vite.config.ts` لتقسيم CSS لكل route (المتاح في Vite 5 default — نتحقق).
- إزالة `@tailwind components;` غير المستخدم إن وُجد.

### E. تقليل عدد chunks الصغيرة
- في `vite.config.ts`: دمج chunks < 5 KiB في `vendor-utils` بدل تركها مستقلة (يقلل HTTP requests من 22 إلى ~12).

### F. Cache headers (للزيارات المتكررة فقط — أثر متوسط)
- إضافة `<link rel="preload" as="font" type="font/woff2" crossorigin>` للخط الرئيسي (موجود لـ cairo-400 من المرحلة 1).
- التحقق هل Lovable يقرأ `public/_headers`. إذا لا، نوثّق ونوصي بحل عبر Cloudflare Transform Rules للدومين المخصص.

## الملفات المُعدَّلة

- `index.html` — inline critical CSS + async load للـ stylesheet
- `src/components/reels/ReelsBar.tsx` — placeholder بدل فيديو عند غياب thumbnail
- `src/components/CategoryCard.tsx` — تأخير autoplay للفيديو + poster
- `vite.config.ts` — دمج chunks صغيرة، تفعيل cssCodeSplit
- (اختياري) `tailwind.config.ts` — تضييق content paths

## مخاطر

- inline critical CSS قد يُضخّم `index.html` بـ 3-5 KiB — مقبول.
- إزالة autoplay للفيديوهات في CategoryCard قد يُغيّر الشكل البصري — سنحافظ على نفس الـ animation لكن مع تأخير 500ms.
- لن نلمس business logic أو DB.

## قياس النجاح

- LCP < 2.5s (من 5.8s) — تخفيض ~3.3s.
- FCP < 1.8s (من 3.8s).
- Performance score > 85.
- حجم تنزيل أول زيارة منخفض بـ ~12 MB.

هل أبدأ بالتطبيق؟
