

## إعادة تصميم بطاقات المنتجات — VisionOS Glass

### الهدف
بطاقات منتجات عائمة بأسلوب الداشبوردات الحديثة (VisionOS / Soft UI / Glass UI): زجاج ناعم، عمق ثلاثي الأبعاد، صورة عائمة، نصوص محفورة، تفاعلات هادئة.

### 1) شكل البطاقة الجديدة (`src/components/ProductCard.tsx`)

تخطيط جديد بنفس البيانات الحالية:

```text
┌─────────────────────────────────┐
│   ✦ light reflection            │  ← انعكاس ضوء + grain خفيف
│                                 │
│        ┌──────────┐             │
│        │  IMAGE   │← floating   │  ← تخرج 12% من الأعلى
│        │  + glow  │             │     ظل ناعم تحته
│        └────╲╱────┘             │
│         soft shadow             │
│                                 │
│  Bambulab X1 Carbon             │  ← اسم محفور
│  متوفر · بيع مباشر              │  ← حالة بسيطة
│                                 │
│  450,000 د.ع    [♡]            │  ← سعر بارز + قلب زجاجي
│  ̶6̶0̶0̶,̶0̶0̶0̶  -25%                │  ← قبل الخصم (إن وجد)
└─────────────────────────────────┘
```

**التغييرات الهيكلية**:
- `rounded-3xl` (24px) بدل `rounded-md` — زوايا دائرية كبيرة.
- `padding` داخلي مريح: `p-3` بدل `p-1.5`.
- الصورة في حاوية `aspect-square` بـ `rounded-2xl` داخلية، مع `mt-[-10%]` لإخراج جزء بسيط منها فوق حد البطاقة (floating effect).
- ظل قطعي تحت الصورة عبر `::after` (radial gradient) — يعطي إحساس بأنها معلّقة.
- تكبير hover من `scale-103` على الصورة فقط إلى رفع كامل للبطاقة + تكثيف الإضاءة.
- زر القلب يصبح زجاجياً (دائري `h-8 w-8`, `backdrop-blur`, شفاف).
- إضافة سطر "حالة" بسيط تحت الاسم: متوفر / غير متوفر / بيع مباشر (يعتمد على `inStock` و `hasDirectSale` الموجودَين).
- عناوين الأسعار بأحجام أكبر قليلاً (`text-base font-bold`) لكن ضمن نفس مفهوم الـminimal.

**ما يبقى كما هو**:
- جميع الـprops والمنطق (favorites, card discounts, sale ribbon, لكنه يصبح badge زجاجي).
- استخدام `formatPrice`, `getLocalizedField`, `useProductCardDiscount` — لا تغيير في الـAPI.

### 2) نظام الزجاج الجديد في CSS (`src/index.css`)

استبدال كتلة `.product-card-glass` الحالية بنظام من ثلاث طبقات:

```css
.product-card-glass {
  position: relative;
  border-radius: 1.5rem;                      /* 24px */
  padding-top: 2.25rem;                        /* مساحة لرأس الصورة العائمة */
  background:
    linear-gradient(155deg,
      hsl(var(--background) / 0.55) 0%,
      hsl(var(--background) / 0.32) 60%,
      hsl(var(--background) / 0.45) 100%);
  backdrop-filter: blur(28px) saturate(1.6);
  border: 1px solid hsl(0 0% 100% / 0.06);    /* حدّ شعري */
  box-shadow:
    0 20px 50px -20px hsl(0 0% 0% / 0.55),    /* ظل خارجي عميق ناعم */
    0 8px 20px -10px hsl(0 0% 0% / 0.35),
    inset 0 1px 0 hsl(0 0% 100% / 0.08),      /* highlight علوي */
    inset 0 -1px 0 hsl(0 0% 0% / 0.25);       /* shadow سفلي داخلي */
  transition: transform 380ms cubic-bezier(.22,1,.36,1),
              box-shadow 380ms ease;
}

/* انعكاس ضوء قطري في الزاوية العلوية */
.product-card-glass::before {
  content: '';
  position: absolute; inset: 0;
  border-radius: inherit;
  background:
    radial-gradient(120% 60% at 15% 0%,
      hsl(0 0% 100% / 0.10) 0%,
      transparent 55%);
  pointer-events: none;
}

/* طبقة grain/noise خفيفة (SVG inline) */
.product-card-glass::after {
  content: '';
  position: absolute; inset: 0;
  border-radius: inherit;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='...' ...><filter id='n'>...turbulence...</filter><rect filter='url(%23n)' opacity='0.5'/></svg>");
  opacity: 0.04;
  mix-blend-mode: overlay;
  pointer-events: none;
}

.product-card-glass:hover {
  transform: translateY(-4px);
  box-shadow:
    0 28px 60px -22px hsl(0 0% 0% / 0.6),
    0 14px 28px -12px hsl(0 0% 0% / 0.4),
    inset 0 1px 0 hsl(0 0% 100% / 0.12),
    0 0 24px hsl(var(--primary) / 0.18);     /* glow خفيف بلون البراند */
}

/* ظل سفلي تحت الصورة العائمة */
.product-card-glass .floating-img-shadow {
  position: absolute;
  bottom: -6%; left: 12%; right: 12%;
  height: 14%;
  background: radial-gradient(50% 100% at 50% 0%,
    hsl(0 0% 0% / 0.35) 0%, transparent 70%);
  filter: blur(8px);
  pointer-events: none;
}

/* نص محفور (engraved) */
.engraved-text {
  color: hsl(var(--foreground));
  text-shadow:
    0 1px 0 hsl(0 0% 100% / 0.06),
    0 -1px 0 hsl(0 0% 0% / 0.35);
}
```

- إزالة `transform: rotateX` ثلاثي الأبعاد المبالغ فيه الحالي (يبدو مائلاً ثابتاً) — استبداله بتأثير hover فقط.
- الحفاظ على `--background` و `--primary` كـsemantic tokens (لا ألوان حرفية).

### 3) شارات الخصم/البيع المباشر زجاجية

تحديث `DirectSaleRibbon` و badge الخصم: خلفية `bg-white/8 backdrop-blur-md border border-white/10` بدل الألوان الصلبة، مع نص بـ glow خفيف. الموقع نفسه (top-left/right) لكن `rounded-full px-2 py-0.5`.

### 4) الشبكة (Grid) والمسافات

لا تغيير في صفحات Home/Category (لتجنّب مخاطر واسعة)، لكن **داخل** البطاقة نفسها يصبح `padding` أكثر سخاءً، فتبدو الشبكة أنظف تلقائياً. إذا وُجدت شبكات بـ`gap-2` صغيرة جداً، سنفتح PR لاحقاً (خارج النطاق).

### 5) الحركة (Motion)

- `hover`: رفع 4px + تكثيف الظل + glow خفيف بلون `--primary` (380ms ease-out).
- `image hover`: `scale(1.04)` على الصورة فقط (200ms).
- لا bounce، لا rotate إضافي — استرخاء VisionOS.
- احترام `prefers-reduced-motion`: تعطيل الرفع والـscale (إضافة guard في CSS).

### الملفات التي ستتغير
- `src/components/ProductCard.tsx` — JSX جديد (نفس الـprops)، تخطيط الصورة العائمة، شارات زجاجية، زر قلب زجاجي، نص محفور.
- `src/index.css` — إعادة كتابة `.product-card-glass` + `::before/::after` (انعكاس ضوء + grain) + `.floating-img-shadow` + `.engraved-text` + reduced-motion guard.

### خارج النطاق
- لا تعديل على `CompactProductCard` (التاجر) — تصميم منفصل.
- لا تعديل على شبكات الصفحات نفسها (Home/Category) في هذه الجولة.
- لا migrations ولا تغييرات في قاعدة البيانات.
- لا تغيير على منطق الإضافة للمفضلة أو الخصومات.

