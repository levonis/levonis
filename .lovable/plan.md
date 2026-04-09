

# خطة: إصلاح رسومات اللعبة + خلل الجذوع في النهر

## المشكلتان

1. **الرسومات**: حالياً كل العناصر (دجاجة، سيارات، أشجار، جذوع، عملات) مرسومة برمجياً بأوامر Canvas. المطلوب استخدام صور PNG حقيقية.
2. **خلل الجذع**: عند القفز على جذع في النهر، الدجاجة تبقى ثابتة بدل أن يسحبها الجذع معه.

## ملاحظة مهمة حول الأصول
مستودع GitHub يستخدم نماذج ثلاثية الأبعاد (.obj) وليس صور 2D sprites. الصور الموجودة هي textures صغيرة للنماذج 3D. لذلك سأقوم بإنشاء sprite sheet بأسلوب pixel-art يحاكي شكل Crossy Road الأصلي، وحفظها كملفات PNG يتم تحميلها في اللعبة بدلاً من الرسم البرمجي.

## التغييرات

### 1. إنشاء صور Sprite (PNG) للعناصر
سأنشئ ملفات PNG باستخدام Canvas offline script وحفظها في `public/games/crossy-road/sprites/`:
- `chicken.png` -- الدجاجة (اللاعب)
- `car-red.png`, `car-blue.png`, `car-green.png`, `car-yellow.png` -- السيارات
- `tree.png` -- الشجرة
- `log.png` -- الجذع
- `train.png` -- القطار
- `coin.png` -- العملة
- `grass-dark.png`, `grass-light.png` -- خلفية العشب
- `water.png` -- خلفية الماء
- `road.png` -- خلفية الطريق
- `rail.png` -- خلفية السكة

### 2. تحديث CrossyRoadCanvas.tsx - تحميل الصور
- إضافة image preloader يحمل كل الـ sprites عند بدء اللعبة
- استبدال كل دوال الرسم البرمجي (`drawChicken`, `drawCar`, `drawTree`) بـ `ctx.drawImage()`
- تحميل الصور في `useEffect` قبل بدء game loop

### 3. إصلاح خلل الجذع (Log Drag)
- إضافة `playerOffsetX: number` لحالة اللعبة لتتبع الإزاحة الأفقية من الجذع
- في دالة `update()`: عند وقوف اللاعب على جذع، تحديث `playerOffsetX += log.speed * dt`
- إذا خرج اللاعب عن حدود الشاشة بسبب حركة الجذع = موت (سقوط)
- في دالة `render()`: إضافة `playerOffsetX` لموضع الرسم الأفقي
- عند القفز (handleMove) إعادة تعيين `playerOffsetX = 0`

### التفاصيل التقنية

```text
// إصلاح الجذع - في update():
if (currentRow.type === "river") {
  for (const log of currentRow.logs) {
    if (playerOnLog) {
      g.playerOffsetX += log.speed * dt;
      // موت إذا خرج عن الحدود
      if (px + g.playerOffsetX < -CELL || px + g.playerOffsetX > CANVAS_W + CELL) {
        g.dead = true;
      }
    }
  }
}

// تحميل الصور:
const sprites: Record<string, HTMLImageElement> = {};
const spriteNames = ['chicken', 'car-red', 'tree', 'log', 'coin', ...];
await Promise.all(spriteNames.map(name => loadImage(`/games/crossy-road/sprites/${name}.png`)));

// الرسم:
ctx.drawImage(sprites.chicken, px - size/2, py - size/2, size, size);
```

### الملفات المتأثرة
- `public/games/crossy-road/sprites/*.png` -- ملفات جديدة (sprites)
- `src/components/games/crossy-road/CrossyRoadCanvas.tsx` -- تحديث شامل (صور + إصلاح الجذع)

