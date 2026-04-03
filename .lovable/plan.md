

# تحديث شامل لأصول وزعماء Knife Rain

## ملخص
استبدال السكين والأهداف الخشبية بالصور الجديدة، حذف بوس الطماطم بالكامل، وإضافة 3 أنواع زعماء جدد (التفاحة، الصخرة، الكيكة) بميكانيكيات فريدة لكل منها.

---

## 1. استبدال الأصول الأساسية

**السكين الجديد**: `Gemini_Generated_Image_9sg5cr9sg5cr9sg5.png` → `src/assets/knife-rain/knife_new.png`
- إزالة `ctx.rotate(Math.PI)` من السكين المنتظر والطائر (الصورة الجديدة النصل للأعلى بشكل صحيح)
- السكاكين المغروزة تبقى بدوران مناسب (النصل نحو المركز)

**الأهداف الخشبية** (تستبدل الـ 4 القديمة بـ 3 جديدة):
- `Gemini_Generated_Image_lz2oy8lz2oy8lz2o.png` → `wood_new_1.png` (سليم)
- `Gemini_Generated_Image_2r2rg72r2rg72r2r.png` → `wood_new_2.png` (شق واحد)
- `Gemini_Generated_Image_u847wpu847wpu847.png` → `wood_new_3.png` (شقين)
- دورة المراحل: wood1 → wood2 → wood3 → wood1 → ... (3 بدل 4)

## 2. حذف بوس الطماطم

- إزالة imports: `bossIdle`, `bossHit`, `shieldWarn1`, `shieldWarn2`, `shieldActive`
- حذف الملفات: `boss_tomato_idle.png`, `boss_tomato_hit.png`, `boss_shield_*.png`
- إزالة منطق `bossHitTimer` المرتبط بالطماطم
- إزالة `candy4` (Candy_4.png) أيضاً

## 3. زعماء جدد

### التفاحة 🍎
- صورة: `Gemini_Generated_Image_d8tncfd8tncfd8tn.png` → `boss_apple.png`
- **ميكانيكية الغصون**: غصون (عوائق) موضوعة بزوايا عشوائية على التفاحة — إذا أصاب السكين غصناً = **خسارة**
- الغصون تُرسم كمستطيلات خضراء صغيرة (حتى يتوفر أصل الغصن لاحقاً — المستخدم كتب "soon")
- تستخدم نفس منطق collision مثل السكاكين المسبقة لكن بنوع مختلف (`obstacle`)

### الصخرة 🪨 (4 أشكال)
- `Gemini_Generated_Image_txey6gtxey6gtxey.png` → `boss_rock_1.png`
- `Gemini_Generated_Image_6c9qzn6c9qzn6c9q.png` → `boss_rock_2.png`
- `Gemini_Generated_Image_eh0ytkeh0ytkeh0y.png` → `boss_rock_3.png`
- `Gemini_Generated_Image_eh0ytkeh0ytkeh0y.png` → `boss_rock_4.png` (نفس الصورة)
- **ميكانيكية المعادن**: معادن (كريستالات زرقاء) بزوايا عشوائية — إصابة المعدن = **خسارة**
- صورة المعدن: `Gemini_Generated_Image_obn4tkobn4tkobn4.png` → `mineral_crystal.png`
- المعادن تُرسم كصور صغيرة على حافة الصخرة تدور معها

### الكيكة 🎂
- لم يرفع صورة — سنرسمها كدائرة وردية مزخرفة بالـ canvas (placeholder)
- **ميكانيكية السكاكين**: سكاكين مغروزة مسبقاً بزوايا عشوائية — إصابة سكين = **خسارة** (نفس منطق collision الحالي لكن السكاكين المسبقة هنا عوائق مميتة)

## 4. نظام المراحل الجديد

```text
كل جولة (round) = 3 مراحل خشب + 1 بوس

تناوب الزعماء:
- Round 1: بوس التفاحة
- Round 2: بوس الصخرة 1
- Round 3: بوس الكيكة
- Round 4: بوس الصخرة 2
- Round 5: بوس التفاحة
- Round 6: بوس الصخرة 3
- ... وهكذا
```

## 5. هيكل العوائق (Obstacles)

إضافة interface جديد:
```text
interface Obstacle {
  angle: number;
  type: 'branch' | 'mineral' | 'knife';
  imgSrc?: string;
}
```

- العوائق تدور مع الهدف وتُرسم على حافته
- عند غرز سكين، يُفحص التصادم مع العوائق أيضاً — إذا أصاب عائقاً = خسارة
- العوائق تُرسم بصورها المخصصة (المعدن = كريستال أزرق، الغصن = placeholder أخضر، السكين = صورة السكين الحالي)

## 6. إصلاح اتجاه السكين المنتظر

- السكين المنتظر في الأسفل: النصل للأعلى (بدون `Math.PI` rotation)
- السكين الطائر: النصل للأعلى أيضاً (بدون rotation)
- السكين المغروز: النصل نحو مركز الهدف (يحتاج rotation مناسب)

---

## الملفات

| الملف | التغيير |
|-------|---------|
| `src/assets/knife-rain/` | 9 صور جديدة، حذف 6 صور قديمة |
| `src/components/games/knife-rain/KnifeRainCanvas.tsx` | إعادة كتابة: أصول جديدة، 3 أنواع زعماء، نظام عوائق، إصلاح الاتجاه |

