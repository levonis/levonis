
## تحسين بطاقات المنتجات — إضاءة سينمائية فاخرة

سيتم تعديل **مظهر بطاقة المنتج فقط** (الألوان/الإضاءة/العمق/الحركة) دون أي تغيير في البنية أو الوظائف أو التخطيط.

### الملفات المعدلة
1. `src/index.css` — إعادة تصميم الكلاس `.product-card-glass` (السطر 1976) + إضافة keyframes للنبض الأحمر.
2. `src/components/ProductCard.tsx` — إضافة طبقتين زخرفيتين (glow + موجة ضوء) داخل البطاقة بشكل `pointer-events-none`.

### 1) الأساس اللوني (Base)
خلفية البطاقة تتدرج بين الأسود العميق والأخضر الداكن `#15382c`:
```css
background:
  radial-gradient(120% 90% at 80% 110%, hsl(0 75% 45% / 0.10) 0%, transparent 55%),
  linear-gradient(155deg,
    hsl(160 35% 14% / 0.55) 0%,    /* #15382c بشفافية */
    hsl(160 30% 8%  / 0.70) 45%,
    hsl(0 0% 4% / 0.85) 100%);     /* أسود عميق */
```
- لا حدود حمراء — الأحمر يُحقن داخل التدرج كـ glow في الزاوية السفلية فقط.
- `backdrop-filter: blur(24px) saturate(1.3)` للحفاظ على إحساس الزجاج.

### 2) العمق (Shadows)
```css
box-shadow:
  0 8px 24px -6px hsl(0 0% 0% / 0.55),               /* ظل خارجي داكن */
  0 1px 0 hsl(160 40% 30% / 0.10) inset,             /* انعكاس علوي ناعم */
  0 -1px 0 hsl(0 0% 0% / 0.40) inset,                /* قاعدة عميقة */
  0 0 0 1px hsl(160 30% 20% / 0.20) inset;           /* إطار زجاجي خفي */
```

### 3) الـ Accent الأحمر — طبقتان داخل JSX
تُضاف كـ `<div>` خلف المحتوى مباشرة بعد فتح الـ `<Link>` (داخل `overflow-hidden`):

**أ) Glow ثابت في الزاوية السفلى** (نبض ناعم دائم):
```tsx
<div className="card-red-glow" aria-hidden />
```
```css
.product-card-glass { overflow: hidden; isolation: isolate; }
.card-red-glow {
  position: absolute; inset: auto -20% -30% auto;
  width: 70%; height: 70%;
  background: radial-gradient(circle, hsl(0 85% 50% / 0.22) 0%, transparent 65%);
  filter: blur(28px);
  mix-blend-mode: screen;
  animation: card-red-pulse 6s ease-in-out infinite;
  pointer-events: none;
}
@keyframes card-red-pulse {
  0%, 100% { opacity: 0.55; transform: translate(0,0) scale(1); }
  50%      { opacity: 0.95; transform: translate(-4%, -3%) scale(1.08); }
}
```

**ب) موجة ضوء حمراء عابرة** (تمر داخل البطاقة كل ~9s، وتتسارع عند hover):
```tsx
<div className="card-red-sweep" aria-hidden />
```
```css
.card-red-sweep {
  position: absolute; inset: 0;
  background: linear-gradient(115deg,
    transparent 30%,
    hsl(0 90% 55% / 0.10) 48%,
    hsl(0 95% 60% / 0.18) 50%,
    hsl(0 90% 55% / 0.10) 52%,
    transparent 70%);
  mix-blend-mode: screen;
  transform: translateX(-120%);
  animation: card-red-sweep 9s ease-in-out infinite;
  pointer-events: none;
}
@keyframes card-red-sweep {
  0%   { transform: translateX(-120%); opacity: 0; }
  20%  { opacity: 1; }
  60%  { opacity: 1; }
  100% { transform: translateX(120%); opacity: 0; }
}
.group:hover .card-red-sweep { animation-duration: 4s; }
.group:hover .card-red-glow  { animation-duration: 3s; }
```

### 4) سلوك Hover
- لا تغيير في الـ scale (يبقى `scale-103` على الصورة كما هو).
- يزداد سطوع الـ glow الأحمر تدريجياً عبر تسريع الـ animation فقط (بدون وميض).
- إضافة ظل أعمق خفيف على hover:
```css
.product-card-glass:hover {
  box-shadow:
    0 14px 36px -8px hsl(0 0% 0% / 0.7),
    0 0 24px -6px hsl(0 80% 45% / 0.18),
    0 0 0 1px hsl(160 35% 25% / 0.25) inset;
}
```

### مبادئ الالتزام
- الأحمر **لا يتجاوز opacity 0.22** في أي طبقة — يبقى كضوء حي لا كلون.
- لا توجد حدود/borders حمراء، فقط blur + screen blend.
- الأخضر `#15382c` + الأسود يشكلان 90%+ من المساحة المرئية.
- جميع الطبقات الجديدة `pointer-events-none` ولن تؤثر على النقر/التفاعل.
- لا تغيير على layout/spacing/typography/أزرار البطاقة.

### النتيجة المتوقعة
بطاقة داكنة فاخرة بإحساس سينمائي: قاعدة سوداء-خضراء عميقة، توهج أحمر هادئ ينبض في الزاوية السفلى، وموجة ضوء حمراء ناعمة تعبر البطاقة دورياً وتتسارع برفق عند المرور بالمؤشر — دون أي حدة أو إزعاج بصري.
