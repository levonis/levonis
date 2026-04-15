

# تحويل آلة الغاتشا من 2D إلى 3D حقيقي باستخدام Three.js

## الوصف
إعادة بناء `GachaMachineVisual` و `GachaSpinReveal` باستخدام `@react-three/fiber` و `@react-three/drei` (الموجودين بالفعل) — بدلاً من CSS divs. كل جزء من الآلة سيكون mesh ثلاثي الأبعاد حقيقي (أسطوانات، كرات، boxes) مع إضاءة ومواد لامعة.

---

## التغييرات

### 1) إنشاء `GachaMachine3D.tsx` — الآلة ثلاثية الأبعاد
مكوّن R3F Canvas يرسم الآلة من أشكال هندسية Three.js:

```text
المكونات الثلاثية:
├── GlassDome (CylinderGeometry + MeshPhysicalMaterial شفاف)
│   └── Capsules[] (SphereGeometry بألوان مختلفة + physics bounce)
├── MachineBody (BoxGeometry / RoundedBox بلون الثيم)
│   ├── Knob (SphereGeometry + CylinderGeometry ذراع) — يدور عند الضغط
│   └── DispensingSlot (BoxGeometry أسود)
├── TopButton (SphereGeometry)
└── Base (BoxGeometry ذهبي)
```

- المواد: `MeshStandardMaterial` للجسم، `MeshPhysicalMaterial` مع `transmission` للزجاج
- الإضاءة: `ambientLight` + `spotLight` + `pointLight`
- الكبسولات داخل الزجاجة تتحرك عشوائياً عند الـ spin
- المقبض يدور 360° مع animation عند الضغط
- ألوان الثيم تُطبق على الجسم (`default`=أحمر، `coupon`=أخضر، `doll`=وردي، `premium`=ذهبي)
- يستخدم `OrbitControls` اختياري أو زاوية ثابتة

### 2) إنشاء `GachaSpinReveal3D.tsx` — أنيميشن الكشف ثلاثي الأبعاد
مكوّن R3F Canvas بتسلسل أنيميشن:

**المرحلة 1 (knob):** الكاميرا تنظر للآلة، المقبض يدور مع اهتزاز الآلة
**المرحلة 2 (drop):** كبسولة 3D (نصف كرة علوي + نصف كرة سفلي) تنزل من الآلة إلى الأسفل بتأثير gravity
**المرحلة 3 (center):** الكاميرا تقترب من الكبسولة وتتوسط الشاشة
**المرحلة 4 (split):** النصف العلوي يرتفع والسفلي ينزل بدوران ثلاثي الأبعاد (rotateX)
**المرحلة 5 (reveal):** الجائزة تظهر بين النصفين مع إضاءة متوهجة (pointLight بلون الندرة) + جزيئات (particles)

الكبسولة مبنية من:
- نصف كرة علوي: `SphereGeometry(r, 32, 16, 0, Math.PI*2, 0, Math.PI/2)` 
- نصف كرة سفلي: مقلوب
- خط الفصل: `RingGeometry` أو `TorusGeometry` رفيع

### 3) تحديث `GachaMachineDetail.tsx`
- استبدال `<GachaMachineVisual>` بـ `<GachaMachine3D>` داخل `<Canvas>`
- عند spinning، تشغيل أنيميشن المقبض
- عند النتيجة، الانتقال لـ `<GachaSpinReveal3D>`

### 4) تحديث `GachaMachineCard.tsx`
- عرض آلة 3D مصغرة (حجم صغير) بدون تفاعل
- أو إبقاء النسخة 2D للبطاقات (أخف) — أقترح إبقاء 2D للبطاقات لأداء أفضل

### 5) الإبقاء على `GachaMachineVisual.tsx` الحالي
- يبقى للبطاقات الصغيرة والأماكن التي لا تحتاج 3D كامل

---

## الملفات

| ملف | عملية |
|-----|-------|
| `src/components/games/gacha/GachaMachine3D.tsx` | إنشاء |
| `src/components/games/gacha/GachaSpinReveal3D.tsx` | إنشاء |
| `src/components/games/gacha/GachaMachineDetail.tsx` | تعديل |
| `src/components/games/gacha/GachaSpinReveal.tsx` | يبقى كـ fallback |

---

## ملاحظات تقنية
- المشروع يستخدم بالفعل `three@0.170`, `@react-three/fiber@8.18`, `@react-three/drei@9.122`
- نفس البنية المستخدمة في CrossyRoad وStackGame
- لا حاجة لملفات OBJ/GLB خارجية — كل الأجزاء ستُبنى من geometries أساسية لتجنب تحميل ملفات كبيرة
- الكبسولات تستخدم ألوان الندرة: رمادي (Common)، أخضر (Uncommon)، أزرق (Rare)، بنفسجي (Epic)، ذهبي (Legendary)

