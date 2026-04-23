

## ضبط موحّد لتأثير الزجاج (Glassmorphism) عبر بطاقات /profile

### الفكرة
إنشاء طبقة CSS موحّدة (`.glass-card`) تحدّد قيم الشفافية، الحدود، الـ blur، والظل في **مكان واحد** — ثم تطبيقها على جميع بطاقات صفحة `/profile`. هذا يضمن تطابقاً كاملاً بصرياً عبر كل الأجهزة، ويجعل أي تعديل مستقبلي على المظهر الزجاجي يتم من ملف واحد فقط.

### 1) Design Tokens — `src/index.css`
إضافة متغيرات CSS تحت `:root` و `.dark` ضمن `@layer base`:

```css
:root {
  /* Glassmorphism — unified across profile cards */
  --glass-bg: 255 255 255 / 0.10;          /* خلفية شبه شفافة (light) */
  --glass-bg-strong: 255 255 255 / 0.18;   /* للهيدر/CTA داخل البطاقة */
  --glass-border: 255 255 255 / 0.20;
  --glass-blur: 20px;
  --glass-saturation: 140%;
  --glass-shadow: 0 8px 32px -12px hsl(var(--foreground) / 0.18);
}
.dark {
  --glass-bg: 255 255 255 / 0.05;
  --glass-bg-strong: 255 255 255 / 0.10;
  --glass-border: 255 255 255 / 0.10;
  --glass-shadow: 0 8px 32px -12px hsl(0 0% 0% / 0.45);
}
```

ثم، تحت `@layer components`:

```css
.glass-card {
  background: rgb(var(--glass-bg));
  border: 1px solid rgb(var(--glass-border));
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturation));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturation));
  box-shadow: var(--glass-shadow);
  border-radius: 1.5rem; /* rounded-3xl */
}
.glass-card-inner {                /* للعناصر الفرعية داخل البطاقة (stats، CTA) */
  background: rgb(var(--glass-bg-strong));
  border: 1px solid rgb(var(--glass-border));
  backdrop-filter: blur(calc(var(--glass-blur) - 6px));
}
/* Fallback لو المتصفح لا يدعم backdrop-filter */
@supports not (backdrop-filter: blur(1px)) {
  .glass-card { background: hsl(var(--card) / 0.85); }
}
```

### 2) توحيد البطاقات الخمس
استبدال الأصناف الحالية المتفرقة (`bg-white/10 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-lg`) بـ `glass-card p-4` في:

- `src/components/profile/OrdersCenter.tsx`
- `src/components/profile/QuickServicesGrid.tsx`
- `src/components/profile/CouponsStrip.tsx`
- `src/components/profile/RecentOrders.tsx`

وللهيدر `src/components/profile/ProfileHeader.tsx`:
- الحاوية الخارجية تبقى تستخدم `linear-gradient` بلون المستوى + `glass-card` (تُستبدل أصناف backdrop/border/shadow الحالية).
- بطاقات الإحصائيات الأربع (Points/Coupons/Wallet/Savings) داخل الهيدر تُستبدل بـ `glass-card-inner` بدلاً من `bg-white/10 backdrop-blur-md border border-white/15`.
- زر CTA السفلي يستخدم نفس `glass-card-inner`.

### 3) ضبط الموبايل (اتساق عبر الأجهزة)
بعض المتصفحات على الموبايل (خاصة Safari iOS الأقدم وWebView على Android) تتعامل مع `backdrop-filter` بشكل غير متسق. لتفادي الاختلافات:
- استخدام `-webkit-backdrop-filter` كنسخة مكررة (مضافة في الـ CSS أعلاه).
- إضافة `transform: translateZ(0)` و `isolation: isolate` على `.glass-card` لتفعيل الـ GPU compositing وتثبيت تأثير الزجاج عبر الأجهزة.
- تخفيف القيم على الشاشات الضعيفة عبر media query:
  ```css
  @media (max-width: 480px) and (prefers-reduced-transparency: reduce) {
    :root { --glass-bg: 255 255 255 / 0.18; --glass-blur: 12px; }
  }
  ```

### بدون تغييرات
- بنية المكونات وعناصر المحتوى داخل البطاقات.
- قاعدة البيانات / المنطق / الترجمة.
- باقي الصفحات (التغيير محصور في بطاقات `/profile`، وفئة `.glass-card` متاحة لاحقاً للاستخدام في أي مكان).

### الملفات المعدّلة
- `src/index.css` — تعريف المتغيرات والفئات الموحّدة.
- `src/components/profile/ProfileHeader.tsx`
- `src/components/profile/OrdersCenter.tsx`
- `src/components/profile/QuickServicesGrid.tsx`
- `src/components/profile/CouponsStrip.tsx`
- `src/components/profile/RecentOrders.tsx`

