

# تصميم صفحة الأقسام الفاخرة - 3D Floating Products

## الملخص
إعادة تصميم صفحة `/category/:slug` بأسلوب فاخر مستوحى من متاجر النباتات الراقية، مع بطاقات منتجات تطفو في فضاء ثلاثي الأبعاد وخلفيات متدرجة خضراء داكنة وتأثيرات زجاجية.

## التغييرات

### 1. إنشاء مكون بطاقة المنتج الفاخرة
**ملف جديد:** `src/components/FloatingProductCard.tsx`

- صورة المنتج تطفو فوق البطاقة بدون إطار أو خلفية (تفترض صور PNG شفافة)
- ظل واقعي ناعم أسفل المنتج (`drop-shadow` + `ellipse shadow`)
- بطاقة بتأثير glassmorphism (خلفية شفافة + blur)
- زوايا مستديرة كبيرة
- عند الـ hover: المنتج يرتفع قليلاً + تكبير + زيادة الظل (transition 0.4s)
- عرض الاسم والسعر بخط أنيق minimal
- نسخة أكبر (featured) مع ارتفاع وحجم أكبر

### 2. إعادة تصميم `CategoryDetail.tsx`
**ملف:** `src/pages/CategoryDetail.tsx`

- **الخلفية**: تدرج أخضر داكن فاخر (`from-emerald-950 via-green-900 to-emerald-950`) بدلاً من `bg-background/95`
- **Hero section**: أول منتج (أو المنتج الأغلى) يُعرض كمنتج مميز بحجم كبير في الأعلى
- **الشبكة**: باقي المنتجات في grid (3 أعمدة على desktop، 2 على mobile)
- **إزالة**: الـ header القديم مع الأيقونة الكبيرة، الـ sort/view toggle (تبسيط)
- **إبقاء**: Breadcrumb (بأسلوب شفاف)، التحميل، حالة عدم وجود منتجات
- **المنتج المميز**: أكبر حجماً، centered أو top، مع ارتفاع إضافي

### 3. الأنيميشن والتأثيرات (CSS)
**ملف:** `src/index.css` (إضافات)

- `@keyframes float` - حركة طفو خفيفة مستمرة للمنتج المميز
- Hover transforms: `translateY(-12px) scale(1.05)` مع `transition: 0.4s cubic-bezier`
- ظل بيضاوي ديناميكي يتقلص عند الرفع

## التفاصيل التقنية

```text
Layout (Desktop):
┌────────────────────────────────────┐
│     Breadcrumb (شفاف)              │
├────────────────────────────────────┤
│         ★ Featured Product ★       │
│      (larger, elevated, centered)  │
├──────────┬──────────┬──────────────┤
│ Product  │ Product  │  Product     │
│  (float) │  (float) │   (float)    │
├──────────┼──────────┼──────────────┤
│ Product  │ Product  │  Product     │
└──────────┴──────────┴──────────────┘

Background: emerald gradient
Cards: glassmorphism + rounded-2xl
Images: PNG transparent, floating with drop-shadow
```

- المنتج المميز = أول منتج أو الأغلى سعراً
- الصور تُعرض بـ `object-contain` وبدون خلفية
- الظل يُنشأ بـ pseudo-element بيضاوي أسفل الصورة
- يتم الاحتفاظ بكل الوظائف الحالية (الروابط، المفضلة، الأسعار)

## الملفات المتأثرة
1. `src/components/FloatingProductCard.tsx` — جديد
2. `src/pages/CategoryDetail.tsx` — إعادة تصميم
3. `src/index.css` — إضافة keyframes

