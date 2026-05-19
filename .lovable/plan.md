
## Goal

أضف نظام تحليل حقيقي لملفات STL/3MF/OBJ في صفحة `/community/quote-from-link` بحيث يستطيع المستخدم اختيار **رابط نموذج** أو **رفع ملف** للحصول على تسعير دقيق مبني على هندسة الملف الفعلية، مع لوحة أدمن لإدارة المواد.

## نطاق الميزة

- لا تعديل على تدفق التجار/العروض/المحادثة الموجود.
- يضيف مسار "Upload file" بجانب "Paste link" داخل نفس الصفحة (تبويبان داخل نفس الكارد).
- التحليل بالكامل داخل المتصفح في Web Worker (لا رفع للملف على السيرفر إلا عند إنشاء طلب طباعة فعلي).
- Edge function `print-quote-from-link` يبقى كما هو للروابط، ويُضاف edge function جديد `price-3d-model` يستقبل المقاييس المحسوبة محليًا ويرجع التسعير + caching.

## تدفق المستخدم

1. على `/community/quote-from-link` يظهر تبويبان: **رابط** / **ملف**.
2. تبويب الملف: سحب وإفلات STL/3MF/OBJ (حد 100MB، رسالة واضحة إن تجاوز).
3. شريط تقدم متعدد المراحل: قراءة → تحميل هندسة → حساب مقاييس → فحص جودة → حساب السعر.
4. النتيجة تظهر في نفس `QuoteResultCard` الحالي + قسم إضافي "تقرير الجودة" يعرض: عدد المثلثات، عدد الحواف غير الصالحة (non-manifold)، نسبة Normals المقلوبة، نسبة Overhangs > 45°، أقل سماكة جدار مكتشفة، توصية الدعامات (نعم/لا).
5. زر "إنشاء طلب طباعة" يرفع الملف لـ Supabase Storage في bucket `print-quote-files` ثم يُنشئ صفًا في `community_print_requests` بنفس الحقول الحالية + `quote_source='file_quote'` + `file_url`.
6. عند فشل التحليل (ملف تالف/كبير جدًا/تجاوز ذاكرة الـ Worker): fallback يطلب من المستخدم إدخال الوزن/الوقت يدويًا أو يستدعي `print-quote-from-link` مع `file_meta` (نفس fallback AI الموجود).

## محرك التحليل (Web Worker)

ملف `src/workers/modelAnalyzer.worker.ts` يحمّل `three` + `three/examples/jsm/loaders/STLLoader` + `OBJLoader` + `3MFLoader` ديناميكيًا (lazy)، ويعالج بـ Transferable ArrayBuffer.

### المقاييس الأساسية
- **الحجم (cm³)**: مجموع `signed volume` لكل tetrahedron من المركز إلى المثلث (`|v1·(v2×v3)|/6`).
- **المساحة (cm²)**: مجموع `0.5·|edge1×edge2|` لكل مثلث.
- **Bounding box**: `geometry.computeBoundingBox()` → X/Y/Z mm.
- **عدد المثلثات**: من index/position.
- **Complexity score 0–100**: تركيبة من (triangle_count log scale, surface_area/volume ratio, overhang_pct).

### فحوصات الجودة
- **Non-manifold**: بناء HashMap للحواف `min(a,b)|max(a,b)` وعدّ الحواف التي ليست مشتركة بين مثلثين بالضبط.
- **Normals مقلوبة**: نسبة المثلثات التي `dot(face_normal, (centroid - mesh_center))` سالبة (heuristic للأشكال المغلقة).
- **Overhangs**: عدّ المثلثات التي زاوية normal مع `-Z` < 45° مقسوم على الإجمالي.
- **سماكة الجدار**: ray casting من مركز كل مثلث على عكس normal باستخدام `THREE.Raycaster` على عينة 500 مثلث (مع `BVH` من `three-mesh-bvh` للسرعة) → أقل مسافة = أقل سماكة.

### تسعير
- **الوزن (g)** = `volume_cm3 × density × (0.2 + 0.8·infill_pct)` (تقريب shell+infill).
- **وقت الطباعة (min)** = `(volume_cm3 × infill_factor) / (nozzle_flow_rate_cm3_per_min)` + `surface_area_cm2 / shell_speed_cm2_per_min` + `bbox_z_mm / layer_height_mm × travel_overhead_sec / 60`.
- **التكلفة الأساس** = `weight_g/1000 × material_cost_per_kg + machine_hours × hourly_cost + complexity_fee` ثم نفس مسار `quote_pricing` الحالي (`platform_fee_pct`, `profit_margin_pct`, تقريب لـ 250 IQD).

## قاعدة البيانات (migration واحدة)

```text
print_materials (
  id uuid pk, code text unique,          -- 'pla'|'petg'|'abs'|'tpu'
  name_ar/en/ku text,
  density_g_cm3 numeric,                  -- PLA 1.24, PETG 1.27, ABS 1.04, TPU 1.21
  cost_per_kg_iqd integer,
  shrinkage_pct numeric,                  -- PLA 0.2, ABS 0.8...
  default_infill_pct numeric default 20,
  default_layer_height_mm numeric default 0.2,
  default_nozzle_mm numeric default 0.4,
  default_print_speed_mm_s numeric default 60,
  is_active boolean default true,
  display_order int
)
+ seed 4 صفوف بقيم صناعية، RLS: قراءة عامة، كتابة admin فقط.

print_machine_profiles (
  id uuid pk, name text,
  hourly_cost_iqd integer,
  nozzle_flow_rate_cm3_min numeric default 8,
  travel_overhead_per_layer_sec numeric default 1.5,
  is_default boolean
)
+ seed صف افتراضي.

print_quote_cache: تضاف 3 أعمدة nullable:
  file_hash text unique,                  -- sha256 من ArrayBuffer
  analysis_payload jsonb,                 -- المقاييس الكاملة
  material_code text
```

## Edge Function: `price-3d-model`

- Input: `{ metrics: { volume_cm3, surface_area_cm2, bbox_mm, triangle_count, overhang_pct, min_wall_mm, non_manifold_edges, complexity }, material_code, infill_pct?, file_hash? }`
- يتحقق من JWT (مستخدم مسجل دخول).
- يقرأ `print_materials` + `print_machine_profiles` + `community_settings.quote_pricing`.
- يحسب التسعير على السيرفر (لا نثق بالعميل في الأرقام النهائية).
- يكتب/يقرأ من `print_quote_cache.file_hash`.
- يرجع نفس شكل response الحالي + `quality_report` + `support_required`.

## واجهة الأدمن

صفحة جديدة `/admin/print-materials` (محمية بـ `AdminRoute`، تُضاف في `adminConfig.ts` تحت قسم "Community"):
- جدول المواد القابل للتعديل المباشر (كثافة، سعر/كجم، انكماش، افتراضيات).
- بطاقة "Machine profile" لتعديل التكلفة بالساعة و flow rate.
- معاينة مباشرة: أدخل حجم/مادة وشوف السعر المحسوب فورًا.

## الواجهة الأمامية — تغييرات ملموسة

| ملف | تغيير |
|---|---|
| `src/pages/CommunityQuoteFromLink.tsx` | إضافة Tabs (Link/File)، حالة الملف، استدعاء الـ Worker، حالة `qualityReport`. |
| `src/workers/modelAnalyzer.worker.ts` | جديد — كل منطق التحليل. |
| `src/lib/modelAnalysis/types.ts` | جديد — أنواع `ModelMetrics`, `QualityReport`. |
| `src/lib/modelAnalysis/analyzeClient.ts` | جديد — wrapper يفتح Worker، يحسب sha256، يرسل ArrayBuffer كـ Transferable، يعرض progress. |
| `src/components/community/QuoteResultCard.tsx` | إضافة قسم "تقرير الجودة" قابل للطي + اختيار المادة من dropdown يعيد حساب السعر. |
| `src/components/community/MaterialPicker.tsx` | جديد — يقرأ `print_materials` ويعرض الأسعار/الكثافات. |
| `src/components/community/QualityReportPanel.tsx` | جديد — badges glass-panel لكل فحص (PASS/WARN/FAIL). |
| `src/pages/AdminPrintMaterials.tsx` | جديد — لوحة الأدمن. |
| `src/App.tsx` | route جديد + lazy import. |
| `src/config/adminConfig.ts` | إضافة عنصر القائمة. |
| `supabase/functions/price-3d-model/index.ts` | جديد. |
| `supabase/migrations/...` | جداول + RLS + storage bucket `print-quote-files` (private، RLS على المالك). |
| ملفات i18n `ar/en/ku` | مفاتيح جديدة للتحليل والجودة والمواد. |

## الحزم المطلوبة

- `three@^0.160` (موجود غالبًا — سأتحقق قبل التثبيت).
- `three-mesh-bvh@^0.7` (لتسريع ray casting لسماكة الجدار).
- `three/examples/jsm/loaders/3MFLoader` يحتاج `fflate` (peer dep خفيفة).

## الأداء والحدود

- حد الملف 100MB قبل التحليل (warning عند 50MB).
- العمل في Worker مع `OffscreenCanvas`/Transferable لتفادي تجميد الواجهة.
- ray casting لعينة 500 مثلث فقط (ليس كل المثلثات).
- caching بـ `file_hash` (sha256 من المحتوى الخام) → إعادة فتح نفس الملف فوريًا.

## خارج النطاق (مستبعد صراحة)

- تقطيع حقيقي layer-by-layer (gcode).
- معاينة 3D للنموذج (يمكن لاحقًا).
- تعديل المنطق التجاري للتجار/العروض/المحادثة.

## أسئلة مفتوحة قبل البناء

1. هل أعرض **معاينة 3D** للنموذج بعد التحليل (Three.js canvas صغير دوّار)؟ مفيدة بصريًا لكن تزيد الحجم.
2. حد الـ file size: 100MB كافي أم تريد 50MB لحماية الذاكرة على الموبايل؟
3. التسعير: هل المستخدم يختار المادة (PLA/PETG/ABS/TPU) ويعيد حساب السعر، أم نعرض 4 أسعار جنبًا إلى جنب؟
4. عند إنشاء طلب طباعة، هل أرفع ملف STL كأصل قابل للتحميل للتجار فقط، أم نكتفي بالمقاييس + thumbnail؟
