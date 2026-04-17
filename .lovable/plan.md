
## خطة: إصلاح اهتزاز الكاميرا عند اليمين/اليسار

### السبب
في الإصلاحات السابقة، أزلتُ الـ lerp على المحور X وجعلتُه يتبع `targetCamX` مباشرة. لكن `targetCamX` يُحسب من `playerOffsetX` الذي يتغير بشكل غير سلس عند الحركة الجانبية:
- `playerOffsetX` يُحدَّث **خطوة واحدة كاملة** عند نهاية القفزة (snap)، بينما خلال القفزة لا يوجد easing بصري للمحور X مثل ما يوجد للمحور Z (`playerVisualZ`).
- النتيجة: عند القفز يميناً/يساراً، الكاميرا تقفز فجأة من موضع لآخر = اهتزاز/قفزة.
- بالإضافة: عند الركوب على جدع متحرك، `playerOffsetX` يتغير كل فريم بسرعة الجدع، مما قد يُنتج تذبذب عند انتقال السرعة.

### الحل
في `useFrame` داخل `CrossyRoad3DScene.tsx`:

**1. حساب `visualX` مُلَرَّب أثناء القفزة الجانبية** (مماثل لـ `visualRow`):
```ts
let visualX: number;
if (g.moving) {
  // Interpolate between fromX and toX with the same easing curve as Z
  const eased = easeInOutQuad(g.moveProgress);
  visualX = g.fromX + (g.toX - g.fromX) * eased;
} else {
  visualX = g.playerLane * CELL + CELL / 2 + g.playerOffsetX;
}
const targetCamX = visualX;
```

**2. إعادة تطبيق lerp مرتبط بـ delta للمحور X** (للتنعيم النهائي بعد القفزة، خاصةً لتنعيم تتبع الجدع المتحرك):
```ts
const smooth = 1 - Math.exp(-14 * dt);
camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetCamX, smooth);
```

**3. استخدام `visualX` في `lookAt`** بدل `targetCamX` المحسوب من القيم المنطقية، لضمان تطابق نقطة النظر مع الموضع البصري الفعلي للاعب.

### الملف المتأثر
- `src/components/games/crossy-road/CrossyRoad3DScene.tsx` (دالة `useFrame`، قسم تحديث الكاميرا فقط)

### النتيجة
- لا قفزات/اهتزاز عند الحركة يميناً/يساراً.
- الكاميرا تتبع اللاعب بسلاسة كاملة على الجدوع المتحركة.
- اتساق بين تنعيم Z و X.
