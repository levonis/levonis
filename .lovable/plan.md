# Premium 3D Model Viewer — المرحلة 1

عارض احترافي للنماذج (STL / 3MF / OBJ / GLB) يندمج داخل صفحة `/community/auto-levo`، بأسلوب CAD احترافي مع زجاجية أبل (Glassmorphism) ووضع داكن افتراضي.

## النطاق (Phase 1 فقط)

يشمل:
- رفع/سحب وإفلات الملف (يُعاد استخدام نفس ملف المستخدم الحالي بدل رفع منفصل)
- عرض حي مع دوران/تكبير/تحريك (OrbitControls)
- زر دوران تلقائي
- وضع Solid / Wireframe
- إضاءة HDRI + ظلال ناعمة + Contact Shadows
- منصة طباعة (Build Plate) قابلة للضبط (افتراضي 256×256 mm)
- صندوق إحاطة (Bounding Box) مع أبعاد حقيقية بالـ mm/cm
- طبقة قياس بسيطة (نقرتان لقياس مسافة بين نقطتين على السطح)
- تصدير لقطة شاشة PNG
- دعم اللمس (pinch zoom / swipe rotate عبر OrbitControls)
- لوحات زجاجية شفافة + dark mode افتراضي + انتقالات ناعمة

مؤجل للمرحلة 2 (لا يُنفّذ الآن):
- Exploded view, Layer preview, Overhang highlight, Orientation optimizer
- Mesh decimation متقدم, Web Worker, AR, رابط مشاركة دائم

## أين يظهر

داخل `src/pages/CommunityQuoteFromLink.tsx`:
- بعد تحميل/تحليل الملف، تظهر بطاقة جديدة "معاينة ثلاثية الأبعاد" فوق/بجانب بطاقة `QuoteResultCard`.
- زر **"عرض النموذج"** يفتح Dialog ملء الشاشة (fullscreen viewer) لتجربة CAD-like.
- يُستخدم نفس `File` الذي رفعه المستخدم (موجود مسبقاً في `fileToUpload`) — لا رفع إضافي.

## البنية التقنية

تثبيت الحزم:
```
three@^0.160
@react-three/fiber@^8.18
@react-three/drei@^9.122
```
ملاحظة: تثبيت إصدارات React-18 المتوافقة (مذكورة في knowledge).

ملفات جديدة:
- `src/components/community/viewer/Model3DViewer.tsx` — مكوّن React Three Fiber الرئيسي (Canvas + Suspense + Environment + Stage + Controls + Plate + BBox + Measurement).
- `src/components/community/viewer/loaders.ts` — تحميل STL/OBJ/3MF/GLB عبر loaders من drei/three-stdlib، يعيد `THREE.BufferGeometry` + أبعاد.
- `src/components/community/viewer/ViewerToolbar.tsx` — شريط أدوات زجاجي (Solid/Wireframe, Auto-rotate, Measure, Screenshot, Reset View, BBox toggle, Plate toggle).
- `src/components/community/viewer/ViewerDialog.tsx` — Dialog ملء الشاشة باستخدام `glass-panel`.
- `src/components/community/viewer/BuildPlate.tsx` — شبكة منصة الطباعة (PlaneGeometry + GridHelper) مع تسمية الأبعاد.
- `src/components/community/viewer/MeasurementOverlay.tsx` — Raycaster لنقطتين + خط + تسمية المسافة بالـ mm.

تعديلات:
- `src/pages/CommunityQuoteFromLink.tsx` — تمرير `fileToUpload` و `analysis.metrics` إلى `Model3DViewer` + إضافة زر فتح Dialog.
- `src/i18n/*` — مفاتيح ترجمة (ar/en/ku) للأزرار والتسميات.

## ASCII Layout

```text
+---------------------------------------------+
|  glass toolbar:  [Solid][Wire][Auto][Meas]  |
|                  [BBox][Plate][Shot][Reset] |
+---------------------------------------------+
|                                             |
|         <Canvas R3F>                        |
|         HDRI env + soft shadows             |
|           Model (centered, scaled mm→m/1000)|
|           BoundingBox helper                |
|           BuildPlate 256×256 grid           |
|         OrbitControls (touch enabled)       |
|                                             |
+---------------------------------------------+
|  glass footer: 124.3 × 88.1 × 42.0 mm       |
+---------------------------------------------+
```

## تفاصيل سلوكية

- وحدة العرض: الأبعاد بالـ mm (نقسم على 1000 لتحويلها لمتر داخل المشهد، أو نستخدم مقياس مباشر).
- اللون والمواد: `meshStandardMaterial` افتراضي، تبديل سريع إلى wireframe.
- الإضاءة: `Environment preset="city"` من drei + `ContactShadows` + ambient خفيف.
- الكاميرا: `PerspectiveCamera` مع `OrbitControls` (damping=0.08, touch enabled).
- الأداء: `Suspense fallback` + توقف render عند عدم التفاعل (`frameloop="demand"`)، حد رفع 200MB مع تحذير عند >50MB ("قد يستغرق وقتاً").
- اللمس: OrbitControls يدعم pinch + drag للموبايل افتراضياً.
- اللقطة: `gl.domElement.toDataURL('image/png')` + تحميل تلقائي.
- الزجاجية: `.glass-panel` للوحات و `.glass-trigger` للأزرار (موجودة في `index.css`).
- i18n: لا نصوص hardcoded، نضيف مفاتيح في ar/en/ku.

## معايير القبول

- رفع ملف STL/3MF/OBJ/GLB حتى 200MB يفتح في العارض دون كسر الصفحة.
- التدوير/التكبير/التحريك يعمل على الديسكتوب والموبايل.
- التبديل Solid/Wireframe، Auto-rotate، BBox، Plate يعمل فورياً.
- أبعاد BBox الظاهرة تطابق `analysis.metrics` (بفارق ≤ 0.5mm).
- لقطة الشاشة تُحمَّل بنجاح بدقة Canvas الحالية.
- اللوحات تتبع نمط Glassmorphism الموجود في المشروع.
