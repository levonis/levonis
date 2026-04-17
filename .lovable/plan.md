
## خطة: إصلاح اهتزاز الكاميرا عند التقدم/التراجع

### المشكلة
رغم الإصلاح السابق لاستخدام `targetCamX/targetCamZ` في `lookAt`، الكاميرا لا تزال تهتز عند الحركة على المحور Z (تقدم/تراجع).

### السبب الجذري المحتمل
بفحص `useFrame` في `CrossyRoad3DScene.tsx`:
1. **`targetCamZ` يُحدَّث كل فريم** بناءً على `playerVisualZ` المحسوب من `playerRow + moveProgress`. هذا سليم.
2. **لكن** الـ lerp بمعامل `0.08` يُطبَّق على `camera.position.z` كل فريم، بينما `lookAt` يستخدم `targetCamZ - 4` (الهدف المستقر). الفجوة بين موضع الكاميرا الحالي (لاحق) والـ lookAt (متقدم) تتغير كل فريم → الزاوية تتأرجح بشكل طفيف.
3. **مشكلة أعمق**: `playerVisualZ` يستخدم easing غير خطي (مثل `easeOutQuad`) خلال القفزة، فـ `targetCamZ` يتسارع/يتباطأ، ثم الـ lerp 0.08 يضيف طبقة ثانية من easing → ينتج تذبذب مرئي ("اهتزاز") خاصة عند بداية/نهاية كل قفزة.
4. **مشكلة محتملة ثالثة**: إذا كان الـ frame rate غير ثابت، استخدام `0.08` كثابت بدل lerp مرتبط بالـ delta يُنتج اهتزازاً على شاشات بمعدلات تحديث متفاوتة.

### الحل

**1. إزالة الـ lerp المزدوج على المحور Z**
- بما أن `targetCamZ` يتبع اللاعب بسلاسة عبر الـ easing الموجود في `playerVisualZ`، لا حاجة للـ lerp إضافي. **استخدام `targetCamZ` مباشرة** لموضع الكاميرا:
  ```ts
  camera.position.z = targetCamZ;  // بدل lerp
  camera.lookAt(targetCamX, 0, targetCamZ - 4);
  ```
- هذا يحذف طبقة easing مزدوجة ويُنهي الاهتزاز.

**2. الإبقاء على lerp المحور X فقط**
- المحور X لا يحتاج easing من القفزة (لا يوجد `playerVisualX` smoothed)، فالـ lerp 0.1 يُعطي السلاسة المطلوبة عند التحرك يميناً/يساراً.

**3. (بديل احتياطي) lerp مرتبط بـ delta**
- إن أبقينا lerp على Z، نستخدم صيغة framerate-independent:
  ```ts
  const t = 1 - Math.exp(-12 * delta);
  camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetCamZ, t);
  ```
- لكن الحل المفضّل هو الخيار 1 (إزالة lerp Z كلياً) لأن `playerVisualZ` نفسه مُلَرَّب أصلاً.

### الملف المتأثر
- `src/components/games/crossy-road/CrossyRoad3DScene.tsx` (دالة `useFrame`، قسم تحديث الكاميرا)

### النتيجة
- لا اهتزاز عند التقدم/التراجع — الكاميرا تتبع اللاعب بسلاسة كاملة.
- حركة أفقية تبقى سلسة كما هي.
