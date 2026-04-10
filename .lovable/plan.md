

# إصلاح مشاكل Crossy Road: الموقع المعكوس، الجذوع، القطار، الشاشة

## المشاكل والإصلاحات

### 1. موقع اللاعب معكوس (Player Position Reversed)
**المشكلة**: اللاعب يظهر بموقع معكوس بسبب أن `playerOffsetX` يُضاف مباشرة لكن حركة الجذع قد تكون بعكس الاتجاه المتوقع.

**الإصلاح في `CrossyRoad3DScene.tsx`**:
- عند القفز على جذع، حساب `playerOffsetX` كالفرق بين موقع اللاعب الشبكي ومركز الجذع الأقرب: `playerOffsetX = (log.x + log.width/2) - (playerLane * CELL + CELL/2)`
- عند مغادرة الجذع، تثبيت الموقع الفعلي للاعب: تحويل `playerOffsetX` إلى أقرب `playerLane` ثم إعادة التعيين

### 2. اللاعب يظهر داخل الجذع عند القفز
**المشكلة**: عند الوصول لصف نهر، يتم إعادة `playerOffsetX = 0` (سطر 356) مما يجعل اللاعب يظهر في موقعه الشبكي بدلاً من مركز الجذع — فيبدو داخل الجذع أو بجانبه.

**الإصلاح**: عند الهبوط على صف نهر جديد (`nowOnRiver && !wasOnRiver`)، العثور على الجذع الأقرب وحساب `playerOffsetX` ليكون فوق مركزه مباشرة.

### 3. موقع مغادرة الجذع غير صحيح
**المشكلة**: عند مغادرة النهر، `playerOffsetX` يبقى بقيمة قديمة مما يجعل اللاعب يظهر بموقع خاطئ على اليابسة.

**الإصلاح**: عند مغادرة النهر (`wasOnRiver && !nowOnRiver`)، حساب الموقع الفعلي `actualX = playerLane * CELL + CELL/2 + playerOffsetX` ثم تحويله لأقرب lane: `playerLane = Math.round((actualX - CELL/2) / CELL)` وإعادة `playerOffsetX = 0`.

### 4. القطار: القطع مرتبة على Y بدل X
**المشكلة**: `TrainMeshGroup` يضع القطع بـ `position={[ti * partWidth, 0, 0]}` لكن `partWidth = 1` صغير جداً — القطع متداخلة. أيضاً القطار ككل `obs.x` يبدأ من `-5` ثم يتحرك، لكن القطع الفردية لا تمتد بشكل صحيح.

**الإصلاح**:
- تغيير `partWidth` من `1` إلى `2` (حجم كل قطعة بعد الدوران 90°)
- ضمان أن القطع مرتبة على محور X الصحيح (وهي كذلك حالياً، لكن المسافة بينها خاطئة)

### 5. Canvas لا يملأ الشاشة على PC
**المشكلة**: الحاوية في MiniGames تضع CrossyRoad داخل `div.relative.z-10` مما قد يقيد الحجم. أيضاً `useResponsiveZoom` يستخدم `Math.min(w,h)` مما يعطي zoom صغير على شاشات عريضة.

**الإصلاح في `MiniGames.tsx`**:
- إخراج CrossyRoad من الـ wrapper `div.relative.z-10` بالكامل — عرضه مباشرة تحت الحاوية `fixed inset-0`

**الإصلاح في `CrossyRoadCanvas.tsx`**:
- تغيير `useResponsiveZoom` ليستخدم `window.innerHeight / 15` بدلاً من `Math.min` — على PC الارتفاع أصغر من العرض فهو المحدد
- إضافة `width: 100vw` للحاوية الرئيسية

## الملفات المتأثرة

### `CrossyRoad3DScene.tsx`
- إصلاح `handleMove`: حساب `playerOffsetX` عند الهبوط على جذع، وتحويله لـ lane عند المغادرة
- تغيير `partWidth` في `TrainMeshGroup` من `1` إلى `2`

### `CrossyRoadCanvas.tsx`
- تعديل `useResponsiveZoom` لاستخدام `innerHeight` بدل `Math.min`
- إضافة `width: 100vw` للحاوية

### `MiniGames.tsx`
- عرض CrossyRoad خارج wrapper `relative z-10`

