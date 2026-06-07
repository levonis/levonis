## تحسين تحميل الصور بتأثير Blur (LQIP)

استبدال السكلتون الحالي بتأثير **LQIP** (Low-Quality Image Placeholder): يتم تحميل نسخة مصغرة (≈24px) ضبابية أولاً، ثم تظهر الصورة الأصلية بانتقال ناعم.

### النطاق
- كل صور المنتجات والبطاقات
- صور STL ومعرض الملفات
- خلفيات المتاجر والصور الكبيرة (StoreBackgroundLayer)
- جميع الصور التي تمر عبر `ImageWithLoader`

### التنفيذ (Frontend فقط — لا تغيير في DB)

**1. تحديث `src/components/ui/ImageWithLoader.tsx`**
- توليد URL مصغر (~24px, q=20) من `resizeSupabaseImage` كـ LQIP
- عرض LQIP في طبقة `<img>` خلفية مع `filter: blur(20px) scale(1.1)` + `transform: scale(1.1)` لإخفاء حواف الـ blur
- الصورة الأصلية فوقها مع `opacity-0` → `opacity-100` بانتقال 500ms
- استبدال shimmer skeleton بـ LQIP (الـ skeleton يبقى fallback لحالة فقدان src)
- الحفاظ على srcSet/sizes/fetchpriority الحالية

**2. تحديث `src/components/merchant/StoreBackgroundLayer.tsx`**
- إضافة طبقة LQIP (نفس الـ URL بعرض 32px, q=15) خلف الـ `<img>` الرئيسية
- blur 30px مع fade-out عندما تكتمل صورة الـ desktop
- يحافظ على الـ decode-ahead الحالي ومستوى الـ veil

**3. إضافة CSS utility في `src/index.css`**
- `.lqip-blur` — `filter: blur(20px); transform: scale(1.08); transition: opacity 400ms ease-out;`
- `.image-fade-in` — opacity transition + will-change

### تفاصيل تقنية
- LQIP يستخدم نفس endpoint الـ Supabase render: `?width=24&quality=20&format=webp` (سريع جداً، <5KB)
- `aria-hidden` على طبقة LQIP لمنع تكرار alt text للـ screen readers
- `pointer-events: none` على LQIP حتى لا يتعارض مع تفاعل الصورة
- للصور غير-Supabase (مثل YouTube thumbnails)، fallback إلى skeleton shimmer الحالي
- لا تغييرات على المنطق أو قواعد البيانات أو الـ RLS

### الملفات المعدّلة
- `src/components/ui/ImageWithLoader.tsx`
- `src/components/merchant/StoreBackgroundLayer.tsx`
- `src/index.css` (utilities فقط)
