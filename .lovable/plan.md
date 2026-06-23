# المرحلة الرابعة — استقرار التخطيط (CLS) + تسريع أول رسم (FCP)

## الهدف
- خفض **CLS** إلى < 0.1 عبر حجز مساحات ثابتة للعناصر المتأخرة في التحميل.
- تقليل **FCP/LCP** عبر إدراج CSS حرج داخل `index.html` وتأجيل الورقة الكاملة.
- قطع آخر سلسلة عرض (render chain) متبقية من المرحلة الثالثة.

## التغييرات

### 1) `index.html` — Critical CSS مضمّن + تحميل لا-حاجز
- إدراج ~3 KiB CSS حرج داخل `<style>` في `<head>`: ألوان الخلفية، الخط الأساسي، أبعاد البانر/الـ Nav، إخفاء الومضة البيضاء.
- تحويل `<link rel="stylesheet">` الرئيسي إلى:
  ```html
  <link rel="preload" as="style" href="..." onload="this.rel='stylesheet'">
  <noscript><link rel="stylesheet" href="..."></noscript>
  ```
- إضافة `<link rel="preload" as="image" fetchpriority="high">` لصورة البانر الأولى المعروفة.

### 2) حجز مساحات (Reserve Space) لمنع CLS
- **`ReelsBar.tsx`**: تثبيت `aspect-ratio` + `min-height` على كل بطاقة ريل قبل تحميل الـ thumbnail.
- **`CategoryCard.tsx`**: تثبيت `aspect-ratio` على الـ wrapper بدلاً من ترك الفيديو/الصورة يحددان الارتفاع.
- **بانر الهوم**: ضبط `width`/`height` صريحين على `<img>` لتجنّب القفزة بعد التحميل.
- **`AppNavBar`**: ضمان `min-height` ثابت قبل ركوب الـ JS (يمنع قفزة بعد hydration).

### 3) خطوط بلا قفزات
- إضافة `font-display: swap` لأي `@font-face` محلي.
- preconnect لـ Google Fonts إن وُجد، وحذف أي خط غير مستخدم فعلياً.

### 4) إزالة CSS غير مستخدم
- مراجعة `tailwind.config.ts` `content` للتأكد من عدم وجود مسارات تجلب CSS زائد.
- إزالة `@tailwind components;` من `index.css` إن لم تكن مستخدمة (وفّر ~5–10 KiB).

## الملفات المُعدّلة
- `index.html`
- `src/components/reels/ReelsBar.tsx`
- `src/components/CategoryCard.tsx`
- `src/pages/Home.tsx` (للبانر فقط)
- `src/index.css` (تنظيف فقط)
- `tailwind.config.ts` (مراجعة `content` إذا لزم)

## ما لن يُلمس
- منطق الأعمال، الأسعار، السلة، RLS.
- `framer-motion` / `radix` chunks (محذّر منه في `vite.config.ts`).
- `DynamicIsland` (يكسر الحركة).

## التحقق
- `tsgo --noEmit`.
- نشر ثم قياس PageSpeed جديد: التركيز على CLS و FCP و LCP.
