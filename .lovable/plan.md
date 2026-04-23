

## جعل خلفية بطاقة المنتج زجاجية فقط (Glassmorphism نقي)

### الوضع الحالي
الكلاس `.product-card-glass` في `src/index.css` (السطور 1982–2028) يطبق على البطاقة:
- **خلفية زجاجية** (backdrop-filter blur + تدرج شفاف) ✅ هذا ما نريد إبقاءه
- **ميلان ثلاثي الأبعاد** (`perspective(800px) rotateX(0.8deg)`)
- **حدود ملوّنة** (border + inset shadows)
- **ظل خارجي قوي** (`box-shadow 0 4px 20px`)
- **لمعة زاوية** عبر `::before` (تدرج قطري في الزاوية العلوية)
- **حركة hover** ترفع البطاقة وتغيّر الميلان والظل

النتيجة: البطاقة تبدو وكأنها لوحة ثلاثية الأبعاد بإطار وإضاءة، وليست مجرد خلفية زجاجية.

### المطلوب
الإبقاء على **الخلفية الزجاجية فقط** (blur + شفافية)، وإزالة كل ما عداها: الميلان، الإطار، الظل الخارجي، اللمعة، وتأثير hover ثلاثي الأبعاد.

### التغيير

**ملف واحد:** `src/index.css` — استبدال الكتلة `.product-card-glass` (السطور 1982–2028) بـ:

```css
/* Glass background only for ProductCard (flat, no 3D, no border, no glare) */
.product-card-glass {
  position: relative;
  border-radius: 0.5rem;
  backdrop-filter: blur(20px) saturate(1.4);
  -webkit-backdrop-filter: blur(20px) saturate(1.4);
  background: linear-gradient(
    170deg,
    hsl(160 35% 14% / 0.3) 0%,
    hsl(160 30% 10% / 0.4) 50%,
    hsl(160 25% 8% / 0.5) 100%
  );
  border: none;
  box-shadow: none;
  transition: background 0.2s ease;
}
```

ملاحظات:
- إزالة `transform: perspective/rotateX` → البطاقة مسطحة.
- إزالة `::before` (اللمعة) وقاعدة `:hover` بالكامل → لا حركة ولا تغيّر إضاءة.
- إبقاء `overflow:hidden` غير ضروري بعد إزالة اللمعة، لكن نتركه افتراضياً عبر صورة المنتج التي تستخدم `overflow-hidden` على الـ`<div>` الداخلي بالفعل، فنحذفه من الكلاس الأم لتفادي اقتطاع غير مرغوب لشارات الخصم.

### خارج النطاق
- لا تغيير على `ProductCard.tsx` (نفس الـ markup وأماكن الشارات).
- لا تغيير على بطاقات أخرى (CategoryCard, CompactProductCard, إلخ).
- لا تغيير على RLS أو قاعدة البيانات.

