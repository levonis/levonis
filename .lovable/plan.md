

# إعادة تصميم صفحة الأقسام - منصات ثلاثية الأبعاد (Pedestals)

## الملخص
تحويل صفحة الأقسام من تصميم "المنتجات الطافية" إلى تصميم "منصات عرض واقعية" حيث يقف كل منتج على قاعدة (Podium) بارتفاعات مختلفة، بدون أي حركة أو أنيميشن.

## التغييرات

### 1. إعادة كتابة `FloatingProductCard.tsx` → تصميم Pedestal
- إزالة كل تأثيرات الطفو والـ hover animations
- إضافة قاعدة/منصة ثلاثية الأبعاد أسفل المنتج باستخدام CSS perspective + transforms
- المنصة: شكل بيضاوي أو مستطيل مع تدرج أخضر متناسق مع الخلفية
- ظل تلامس واقعي (contact shadow) حيث يلمس المنتج المنصة
- المنتج المميز: منصة أكبر وأعلى مع إضاءة أقوى (gradient highlight)
- بدون borders، بدون card outlines، بدون خلفية بطاقة
- تخطيط ثابت تماماً (static) بدون hover effects

### 2. تحديث `CategoryDetail.tsx`
- تغيير الشبكة لتدعم منصات بارتفاعات مختلفة (staggered heights)
- المنتج المميز centered في الأعلى على منصة كبيرة
- باقي المنتجات على منصات أصغر في grid متوازن
- إبقاء الـ breadcrumb والعنوان والحالات (loading, empty)

### 3. تحديث CSS في `index.css`
- إزالة `.floating-card`, `.floating-card-featured`, `@keyframes product-float`
- إضافة `.pedestal-platform` — القاعدة ثلاثية الأبعاد بـ CSS transforms
- إضافة `.pedestal-shadow` — ظل التلامس
- إضافة `.pedestal-featured` — نسخة أكبر مع highlight
- تحديث `.category-luxury-bg` لتشمل إضاءة شعاعية خفيفة (radial gradient)

## التفاصيل التقنية

```text
Product on Pedestal (CSS 3D):
┌─────────────────┐
│                  │
│   [Product PNG]  │  ← object-contain, no border
│                  │
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│  ← contact shadow (blur ellipse)
│  ╔════════════╗  │  ← platform top face (perspective transform)
│  ║  PLATFORM  ║  │  ← platform front face (darker gradient)
│  ╚════════════╝  │
│    ░░░░░░░░░░    │  ← ground shadow
└─────────────────┘

Platform CSS approach:
- Top face: rotateX(60deg) with green gradient
- Front face: pseudo-element with darker shade
- Contact shadow: radial-gradient ellipse at base
```

- المنصة تُبنى بـ CSS فقط (بدون Three.js/Canvas)
- `perspective` على الحاوية لإعطاء عمق ثلاثي الأبعاد
- المنصة تتناسق مع الخلفية باستخدام نفس توكنات الألوان
- ارتفاعات مختلفة للمنصات تُحدد بـ CSS classes

## الملفات المتأثرة
1. `src/components/FloatingProductCard.tsx` — إعادة كتابة كاملة
2. `src/pages/CategoryDetail.tsx` — تحديث الشبكة
3. `src/index.css` — استبدال floating styles بـ pedestal styles

