

## تحسين بطاقات المنتجات لتصميم زجاجي شفاف ثلاثي الأبعاد (Glassmorphism 3D)

### الملفات المتأثرة
- `src/components/ProductCard.tsx` — بطاقة المنتج الرئيسية (الصفحة الرئيسية)
- `src/components/FloatingProductCard.tsx` — بطاقة المنتج في صفحات الأقسام (non-featured)
- `src/index.css` — تعديل `.product-card-green` + إضافة أنماط جديدة

### التعديلات

#### 1. `src/index.css` — تحديث `.product-card-green` للتأثير الزجاجي
- زيادة `backdrop-filter: blur(20px)` لتأثير زجاجي أعمق
- تقليل شفافية الخلفية لتصبح أكثر شفافية (`0.3` - `0.5`)
- إضافة حد داخلي علوي مضيء (`inset border glow`) لمحاكاة انعكاس الضوء
- إضافة `box-shadow` متعدد الطبقات لعمق ثلاثي الأبعاد
- إضافة `::before` pseudo-element لتأثير الانعكاس الزجاجي (شريط ضوء علوي)
- إضافة `transform: perspective(800px) rotateX(1deg)` خفيف للإحساس بالعمق

#### 2. `src/components/ProductCard.tsx` — تأثير زجاجي
- استبدال `bg-gradient-to-b from-card to-card/80` بكلاسات زجاجية جديدة
- إضافة `backdrop-blur-xl bg-white/5 border-white/10`
- إضافة طبقة انعكاس ضوئية (shine overlay) فوق الصورة
- تأثير `hover` مع ارتفاع خفيف وتوهج حول الحواف

#### 3. `src/components/FloatingProductCard.tsx` — نفس التأثير الزجاجي
- تحديث البطاقة العادية (non-featured) لاستخدام نفس الأسلوب الزجاجي الجديد

### النتيجة المتوقعة
```text
┌─────────────────────┐
│  ╭ shine reflection  │  ← شريط ضوء زجاجي
│  ┌─────────────────┐ │
│  │                 │ │  ← صورة المنتج
│  │    Product Img  │ │
│  └─────────────────┘ │
│  ─── floor line ───  │
│  Product Name        │
│  ★ 25,000 د.ع       │  ← سعر + خصم
│  backdrop-blur glass │  ← خلفية زجاجية شفافة
└──── 3D shadow ───────┘  ← ظل ثلاثي الأبعاد
```

