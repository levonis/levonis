

# خطة: تحويل لعبة Crossy Road إلى 3D باستخدام نماذج OBJ الأصلية

## ملخص
تحويل اللعبة من Canvas 2D إلى Three.js 3D باستخدام ملفات OBJ + PNG textures الأصلية من مستودع GitHub، وحذف ملفات sprites PNG القديمة.

---

## المرحلة 1: تحميل الأصول (OBJ + PNG)

تحميل الملفات من GitHub إلى `public/games/crossy-road/models/`:

**الشخصية:**
- `characters/chicken/0.obj` + `0.png`

**المركبات:**
- `vehicles/blue_car/0.obj` + `0.png`
- `vehicles/green_car/0.obj` + `0.png`
- `vehicles/orange_car/0.obj` + `0.png`
- `vehicles/purple_car/0.obj` + `0.png`
- `vehicles/taxi/0.obj` + `0.png`
- `vehicles/blue_truck/0.obj` + `0.png`
- `vehicles/red_truck/0.obj` + `0.png`
- `vehicles/police_car/0.obj` + `0.png`
- `vehicles/train/0.obj` + `0.png`

**البيئة:**
- `environment/tree/0.obj` + `0.png`
- `environment/log/0/0.obj` + `0.png`
- `environment/grass/0.obj` + `0.png`
- `environment/road/0.obj` + `0.png`
- `environment/railroad/0.obj` + `0.png`
- `environment/river/0.obj` + `0.png`
- `environment/boulder/0.obj` + `0.png`
- `environment/lily_pad/0.obj` + `0.png`
- `environment/train_light/0.obj` + `0.png`

---

## المرحلة 2: إعادة كتابة محرك اللعبة (Three.js)

### حذف الملفات القديمة
- حذف `public/games/crossy-road/sprites/*.png` (15 ملف)

### إنشاء ملفات جديدة

**`CrossyRoadCanvas.tsx`** -- إعادة كتابة كاملة:
- استبدال `<canvas>` بـ `<Canvas>` من `@react-three/fiber`
- كاميرا isometric (OrthographicCamera) تنظر من أعلى بزاوية
- إضاءة (ambient + directional) لمظهر Crossy Road الأصلي
- استخدام `OBJLoader` + `TextureLoader` من Three.js لتحميل النماذج

**`CrossyRoad3DScene.tsx`** -- مكون جديد (المشهد الرئيسي):
- يحتوي على كل المنطق الموجود حالياً (update, collision, input) لكن يرسم بـ Three.js بدل Canvas
- كل صف (Row) = مجموعة من meshes ثلاثية الأبعاد
- اللاعب = نموذج chicken.obj يتحرك على الشبكة
- السيارات = نماذج OBJ متحركة على المحور X
- الأشجار/الصخور = نماذج OBJ ثابتة
- الجذوع = نماذج log OBJ متحركة
- القطارات = نماذج train OBJ

**`CrossyRoadModels.tsx`** -- مكون تحميل النماذج:
- preloader يحمّل كل ملفات OBJ + textures مرة واحدة
- يعيد استخدام الـ geometry/material المحمّلة (instancing)

### منطق اللعبة (نفس المنطق الحالي مع تعديلات):
- الشبكة: كل خلية = وحدة واحدة في الفضاء 3D
- الكاميرا تتبع اللاعب عمودياً (المحور Z في 3D)
- نفس أنظمة: التصادم، سحب الجذع، القفز، توليد الصفوف
- التحكم: نفس أحداث لوحة المفاتيح واللمس

---

## المرحلة 3: التكامل

- الحفاظ على نفس الواجهات (Props) حتى لا يتأثر `CrossyRoadGame.tsx`
- `onGameOver`, `onScoreUpdate`, `scoreSettings` تبقى كما هي
- الصوت يبقى كما هو (`CrossyRoadAudio.ts`)

---

## التفاصيل التقنية

```text
// هيكل الملفات الجديد:
public/games/crossy-road/models/
├── characters/chicken/     (0.obj, 0.png)
├── vehicles/blue_car/      (0.obj, 0.png)
├── vehicles/green_car/     ...
├── vehicles/taxi/          ...
├── vehicles/train/         ...
├── environment/tree/       (0.obj, 0.png)
├── environment/log/0/      (0.obj, 0.png)
├── environment/grass/      ...
├── environment/road/       ...
├── environment/river/      ...
└── environment/railroad/   ...

// حذف:
public/games/crossy-road/sprites/  (كل المجلد)

// تعديل:
src/components/games/crossy-road/CrossyRoadCanvas.tsx  -- إعادة كتابة كاملة
// إنشاء:
src/components/games/crossy-road/CrossyRoad3DScene.tsx  -- المشهد 3D
src/components/games/crossy-road/CrossyRoadModels.tsx   -- تحميل النماذج
```

### التقنيات المستخدمة
- `@react-three/fiber` (v8.18 -- موجود بالمشروع)
- `@react-three/drei` (v9.122 -- موجود بالمشروع)
- `three` OBJLoader + TextureLoader لتحميل ملفات .obj و .png
- OrthographicCamera لمنظور isometric مثل اللعبة الأصلية

