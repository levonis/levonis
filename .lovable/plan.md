# تحسينات memoization إضافية لـ StoreBackgroundLayer

## الوضع الحالي
المكوّن مغلّف بـ `React.memo` ويستخدم `useMemo` لكل style، لكن لا تزال هناك فرص:
- `useViewportBucket` يُرجع `window.innerWidth` الخام → كل pixel resize = re-render وإعادة إنشاء `responsiveUrl`.
- `cssBgStyle` و `veilStyle` يُنشئان كائن جديد في كل render مختلف رغم أن المدخلات تتكرر كثيراً (مثلاً نفس قيمة blur=20).
- `React.memo` يستخدم shallow compare الافتراضي → `value: null` vs `value: undefined` يُعتبران مختلفين ويُسبّبان re-render زائف.
- className strings مُكرّرة في الـ JSX (تُعاد قراءتها في كل render، لا أثر للأداء لكن تنظيم).

## التغييرات

### 1. Bucketing الـ viewport
بدل تخزين `window.innerWidth` الخام، snap إلى أقرب width من `BACKGROUND_RESPONSIVE_WIDTHS = [640, 960, 1280, 1600, 1920, 2560]`. النتيجة: resize من 1281→1599 لا يُسبّب أي re-render. استخدام `setBucket((prev) => prev === next ? prev : next)` كحارس إضافي.

### 2. كاش style على مستوى الـ module
- `cssBackgroundCache: Map<string, CSSProperties>`: يخزّن `{ background: <color/gradient> }` لكل قيمة فريدة. مع cap عند 64 entry (FIFO eviction).
- `veilStyleCache: Map<number, CSSProperties>`: 61 مفتاح ممكن فقط (blur 0-60).
- `GLASS_STYLE`, `VIGNETTE_STYLE`: ثوابت `Object.freeze` على مستوى الـ module.

النتيجة: نفس المدخلات → نفس object reference → React يتجاوز DOM style update تماماً.

### 3. تطبيع `safeBlur`
استخدام `Math.round` على `safeBlur` لمنع cache misses بسبب أرقام عشرية (20.0001 vs 20).

### 4. Custom `arePropsEqual` لـ `React.memo`
- يطبّع `value: null/undefined` كقيمة واحدة.
- يطبّع `blur` (clamp + round) قبل المقارنة → تغيّر slider من 20.2 إلى 20.4 لا يُسبّب re-render.

### 5. State setter حارس داخل `useDecodedImage`
استخدام functional setter `setResolved((prev) => prev === url ? prev : url)` لتجنّب re-render إذا كانت القيمة الحالية مساوية بالفعل.

### 6. رفع class strings لثوابت module
`ROOT_CLASS`, `LAYER_CLASS`, `VEIL_CLASS`, `IMG_CLASS` → تنظيم أوضح (أثر أداء صفر، لكن أسهل للقراءة والصيانة).

## الملفات المتأثرة
- تعديل: `src/components/merchant/StoreBackgroundLayer.tsx` فقط
- لا تغيير على API المكوّن (props كما هي).
- لا تغيير على قاعدة البيانات أو ملفات أخرى.

## النتيجة المتوقعة
- Resize ضمن نفس bucket: **0 re-renders** (كان: re-render لكل pixel).
- نفس config متكرر: **نفس object refs** للـ styles → React يتجاوز diff تماماً.
- تغيّر blur عشري طفيف: **لا re-render** (كان: re-render كامل).
- ذاكرة محدودة: caches مع cap واضح (max ~125 entries مجتمعة).
