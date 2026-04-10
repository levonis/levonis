

# إصلاح لعبة Crossy Road 3D — اللعبة لا تعمل

## السبب الجذري
`MODEL_SCALE = 0.009` يصغّر النماذج 3D إلى حجم غير مرئي (0.004 وحدات). النماذج الأصلية بالفعل بمقاس مناسب (الدجاجة ~0.5x0.9 وحدة، السيارة ~0.8x1.3 وحدة).

## الإصلاحات المطلوبة

### 1. إصلاح حجم النماذج (`CrossyRoad3DScene.tsx`)
- تغيير `MODEL_SCALE` من `0.009` إلى `1.0` — النماذج ستظهر بحجمها الطبيعي المناسب للشبكة

### 2. إصلاح حركة الكاميرا (`CrossyRoad3DScene.tsx`)
- الكود الحالي يستخدم `camera.position.z += (targetZ + 8) * 0.05` مما يسبب انحراف (drift)
- الإصلاح: استخدام `lerp` صحيح: `camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetZ + 8, 0.05)`

### 3. إصلاح إعداد الكاميرا الأولي (`CrossyRoadCanvas.tsx`)
- ضبط الكاميرا الأولية لتكون متسقة مع منطق المتابعة في المشهد
- تعديل `zoom` و `position` لتتناسب مع المقاس الجديد

### 4. إصلاح تداخل الحاويات (`MiniGames.tsx`)
- عند تشغيل Crossy Road، إزالة `PixelBackground` و `overflow-y-auto` من الحاوية الأم لمنع التداخل مع Canvas المثبت

## الملفات المتأثرة
- `src/components/games/crossy-road/CrossyRoad3DScene.tsx` — MODEL_SCALE + camera logic
- `src/components/games/crossy-road/CrossyRoadCanvas.tsx` — camera setup
- `src/pages/MiniGames.tsx` — container cleanup for crossy_road

