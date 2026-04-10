

# إصلاح مشاكل Crossy Road: الجذوع، القطار، الدجاجة، الشاشة

## المشاكل والإصلاحات

### 1. الجذوع طويلة جداً
- حالياً `log.width = 2` ويتم تطبيق `scaleX = data.logWidth` (أي 2x) على نموذج OBJ الذي عرضه ~1 وحدة
- **الإصلاح**: تقليل `log.width` إلى `1.2` في `generateRow` وضبط الـ scale ليكون مناسباً بصرياً

### 2. موقع القطار غير صحيح
- حالياً `partWidth = 5` ثابت بين قطع القطار، والقطار يُنشأ كـ obstacle عادي بـ `x: -5` ثم يتحرك
- **الإصلاح**: ضبط `partWidth` ليتناسب مع حجم نموذج القطار الفعلي (~4.875 وحدة)، وتحديث موقع القطار ليبدأ من خارج الشاشة بشكل صحيح. ربط موقع مجموعة القطار بـ `obs.x` بدلاً من القيمة الثابتة

### 3. الدجاجة لا تدور عند تغيير الاتجاه
- حالياً يُعرض نموذج الدجاجة بدون أي rotation بغض النظر عن اتجاه الحركة
- **الإصلاح**: 
  - إضافة `playerRotation` إلى `PlayerSnapshot` و `GameState`
  - عند الحركة: up → `rotation-y = π`, down → `0`, left → `π/2`, right → `-π/2`
  - تطبيق الدوران على mesh الدجاجة

### 4. Canvas لا يملأ الشاشة
- الحاوية في `MiniGames.tsx` تستخدم `fixed inset-0` لكن الـ `div` الداخلي بدون constraints قد يتداخل
- الـ Canvas في `CrossyRoadCanvas.tsx` يستخدم `position: fixed` وهو صحيح، لكن قد يكون هناك تداخل مع عناصر أخرى
- **الإصلاح**: التأكد من أن حاوية CrossyRoad في MiniGames لا تضيف أي padding/margin، وإزالة الـ wrapper div الإضافي (`relative z-10`) عند crossy_road

## الملفات المتأثرة

### `CrossyRoad3DScene.tsx`
- تقليل `log.width` في `generateRow` من `2` إلى `1.2`
- إضافة `playerRotation` إلى snapshot وتحديثه حسب `moveDir`
- ضبط `TrainMeshGroup` لتتبع `obs.x` الفعلي بدل الثابت
- تطبيق rotation على mesh الدجاجة

### `MiniGames.tsx`
- إزالة wrapper div عند `crossy_road` ليكون Canvas مباشرة تحت `fixed inset-0`

