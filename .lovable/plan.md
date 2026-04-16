

# إصلاح أبعاد المنصة والصورة للمنتج المميز على الشاشات الصغيرة

## المشكلة
- صورة المنتج المميز ثابتة عند `h-64 w-64` (256px) على جميع الأحجام
- المنصة ثلاثية الأبعاد ثابتة عند `260px` عرض
- لكن الحاوية على الموبايل `w-32` (128px) فقط — كل شيء يفيض ويتداخل

## الإصلاح

### 1. `src/components/FloatingProductCard.tsx`
- تغيير أبعاد الصورة من `h-64 w-64 md:h-80 md:w-80` إلى `h-28 w-28 sm:h-48 sm:w-48 md:h-80 md:w-80`
- تغيير ظل الصورة السفلي ليتناسب مع الحجم الصغير
- تغيير انعكاس الأرض السفلي ليتناسب

### 2. `src/index.css`
- إضافة breakpoint صغير للمنصة: الأبعاد الافتراضية (mobile) تصبح أصغر (~160px عرض)
- إضافة `@media (min-width: 640px)` بأبعاد متوسطة (~260px الحالية)
- إبقاء `@media (min-width: 768px)` للشاشات الكبيرة (360px)

### التفاصيل التقنية

**CSS الافتراضي (mobile):**
```
.cube-top-highlight { width: 160px; height: 3px; }
.cube-top-featured { width: 160px; height: 18px; }
.cube-mid-featured { width: 160px; height: 3px; }
.cube-front-featured { width: 160px; height: 36px; }
.cube-bottom-edge { width: 150px; height: 4px; }
.cube-bottom-reflection { width: 145px; height: 6px; }
.cube-ambient-glow { width: 180px; height: 10px; }
.cube-glow-ring { width: 160px; height: 8px; }
```

**`@media (min-width: 640px)` — tablet:**
القيم الحالية الافتراضية (260px)

**`@media (min-width: 768px)` — desktop:**
يبقى كما هو (360px)

### الملفات المتأثرة
| الملف | النوع |
|-------|-------|
| `src/components/FloatingProductCard.tsx` | تعديل |
| `src/index.css` | تعديل |

