## الهدف

تحسين دقة الاستخراج في `supabase/functions/extract-product-info/index.ts` لحقول: **الخيارات، الألوان، الصور الرئيسية، الوصف، الأبعاد** — خاصة لروابط Bambu Lab (filament/parts) ومتاجر Shopify العامة المشابهة. تركيز على خرائط حقول أدق + فلاتر تنظيف.

## النطاق

ملف واحد فقط: `supabase/functions/extract-product-info/index.ts`. لا تغيير في الـ frontend ولا في قاعدة البيانات.

## التحسينات

### 1) خرائط الحقول الدقيقة (Field maps)

أ. **الألوان – Bambu**
- توسيع `bambuBaseColorMap` و`bambuQualifierMap` لتغطية: Matte / Silk+ / Glow / Sparkle / Marble / Galaxy / Translucent / Dual Color / Gradient / CF / GF / HF.
- عند فشل التطابق، استخراج رمز ست عشري من صورة swatch (موجود) + احتياطي: المسار الجزئي للصورة قد يحتوي اسم اللون (`.../red-yellow.png`).
- توحيد الأسماء المكررة بحرف الكبير/الصغير وفراغات داخلية قبل المقارنة في `seenColorNames`.

ب. **الخيارات – Bambu / Shopify**
- إضافة طبقة JSON-LD: قراءة `<script type="application/ld+json">` لاستخراج `offers[].sku` و`hasVariant[]` كمصدر أولي قبل تحليل HTML.
- التقاط axes إضافية شائعة: `Nozzle Diameter`, `Material`, `Capacity`, `Spool Type`, `Plate Size`, `Build Plate` — مع تصنيفها كـ options دائماً (لا colors).
- استخراج `price_adjustment` من JSON-LD عند توفره (دلتا السعر بين variants).

ج. **الوصف**
- ترتيب أولوية: `<meta name="description">` → `<meta property="og:description">` → JSON-LD `description` → أول فقرة معنوية من `<main>`/`#product-description`.
- تنظيف: إزالة "Free shipping", "Add to cart", قوائم التنقل، روابط CTA، scripts، tags HTML المتبقية.
- اقتطاع لـ ≤2000 حرف مع المحافظة على الجمل الكاملة.

د. **الأبعاد والوزن**
- خريطة units: in→cm (×2.54)، mm→cm (÷10)، lb→kg (×0.4536)، g→kg (÷1000)، oz→kg (×0.02835).
- regex مرتب الأولوية: `Package Size`, `Carton Size`, `Box Dimensions` (gross) > `Product Size`, `Item Dimensions` (net).
- لـ Bambu specifically: قراءة جدول specs (`<table class="specs">` أو DL list) مع مفاتيح مثل "Spool Dimensions", "Net Weight", "Gross Weight".

### 2) فلاتر حالات الصفحة (Page-state filters)

أ. **فلتر صور**
- استبعاد صور <200×200 (من attributes width/height) أو من مسارات معروفة: `/icons/`, `/logos/`, `/banners/`, `/recommendations/`, `/social/`, `favicon`, `sprite`.
- استبعاد صور swatches الصغيرة من gallery (تبقى مرتبطة باللون فقط).
- إزالة duplicates عبر `getImageBaseUrl` (موجود) + تطبيع amazon/cdn query suffixes.

ب. **فلتر خيارات**
- تخطّي خيارات بـ `disabled`/`unavailable`/`sold-out` markers في HTML المحيط.
- تخطّي قيم رقمية صرفة (`/^\d+$/`) — موجود — وتوسيعه ليشمل قيم تبدأ بـ `+$` أو `+€`.
- دمج خيارات متطابقة بعد التطبيع (case-insensitive، trim، collapse whitespace).

ج. **فلتر ألوان**
- تخطّي ألوان `Out of Stock` إن أمكن تحديدها (class/attribute في `<li>`).
- إزالة ألوان شبه متطابقة (فرق ΔE<5 في hex) لتجنّب "Red"/"Dark Red" المتكررة كنوع واحد عندما لا توجد swatch مختلفة فعلياً.

### 3) Logging تشخيصي

سطر `console.log` واحد بعد كل مرحلة:
```
[Extract:bambu] colors=N options=M axes=[...] filtered_images=X/Y
[Extract:desc] source=jsonld|og|meta|paragraph length=N
[Extract:dims] source=table|regex|jsonld L=.. W=.. H=.. kg=..
```

## ما لن يتغير

- لا تغيير في تركيب الـ response أو أسماء الحقول التي يقرأها الـ frontend (`productInfo.colors`, `.options`, `.images`, `.description`, `.dimensions`, `.weight_kg`).
- لا تغيير في الـ AI prompt أو الـ model.
- لا تغيير في حدود الصلاحيات/RLS.

## التحقق

1. اختبار `https://us.store.bambulab.com/products/pla-basic-filament` — يجب إرجاع 15+ لون مع swatches و1-3 options (Spool Type / Weight).
2. اختبار `https://us.store.bambulab.com/products/bambu-engineering-plate` — يجب أن تبقى 9 خيارات (كما كانت) دون فقد.
3. اختبار رابط Shopify عام — التأكد من عدم regression.
4. فحص edge function logs بعد كل اختبار للتأكد من سطور `[Extract:*]` تظهر بالقيم المتوقعة.
5. التأكد من ملء الـ frontend لكل الحقول (الـ Admin.tsx لا يحتاج تعديل).
