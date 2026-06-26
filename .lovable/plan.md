## التشخيص من اللوجات الفعلية

من لوج آخر تشغيل لـ `extract-product-info` على `us.store.bambulab.com/products/pla-pure`:

```
[Extract:bambu] final name= https://bambulab.feishu.cn/wiki/Q15uwKCsgiRH1wkrGN7cKM5bnHd 
                | name_ar= https://bambulab.feishu.cn/wiki/Q15uwKCsgiRH1wkrGN7cKM5bnHd
Dimensions: null   Weight (kg): null
descLen=139  descArLen=0
AI error: 402 Not enough credits
```

السبب الجذري لكل حقل:

1. **الاسم URL غريب** — JSON-LD لمنتج Bambu يحتوي حقل `name` يساوي رابط ويكي Feishu (صفحة الـ Wiki الداخلية للمنتج). الكود الحالي يقبل أي `Product.name` من JSON-LD بدون التحقق إن كان URL، فيستخدمه كاسم. الـ slug fallback ("pla-pure" → "PLA Pure") لا يُستدعى لأن `bambuCleanName` غير فاضي.

2. **الوصف العربي فارغ** — الإنجليزي عُبِّئ (139 حرف) من JSON-LD/meta، لكن `description_ar` لم يُملأ لأن AI رجع 402 ولا fallback يعكس الوصف الإنجليزي إلى العربي حتى ولو بنفس النص مؤقتاً.

3. **الأبعاد والوزن فارغة** — JSON-LD لـ Bambu لا يحتوي `weight`/`height`/`width`/`depth`. الكود لا يقرأ جدول المواصفات داخل صفحة المنتج (Bambu يعرضها كـ HTML table أو list مع كلمات "Net Weight", "Diameter", "Spool Size", "Dimensions"). البحث الويبي يُستدعى لكنه يستخدم AI الذي رجع 402.

4. **كود hex خاطئ للألوان** — `parseBambuLabUnified` يأخذ صور swatch ثم يستخرج لون hex منها بـ `fetch + sampling`. على Bambu قد تكون صورة swatch خلفيتها بيضاء/شفافة مع دائرة لون داخلها، أو الـ sampling يأخذ بكسل من زاوية شفافة → ينتج hex خاطئ. الحل: قراءة `colorHex` المعلَن في JSON الـ variant (Bambu يخزن `propertyHex` أو `colorHex` كحقل صريح) واستخدامه قبل اللجوء إلى sampling الصورة.

## الإصلاحات (محصورة في `supabase/functions/extract-product-info/index.ts`)

### 1) رفض الاسم URL وإجبار slug
في كتلة `bambuCleanName` (≈سطر 2867-2899)، أضف فلتر صلاحية:

```ts
const isValidProductName = (s: string) =>
  !!s && s.length >= 3 && !/^https?:\/\//i.test(s) && !/feishu|notion|wiki\.|docs\.google/i.test(s);
```

- تجاهل `n.name` من JSON-LD إذا فشل `isValidProductName`.
- تجاهل `og:title` بنفس الفلتر.
- إذا الناتج النهائي ما زال غير صالح → اشتق من slug الـ URL (`pla-pure` → `PLA Pure`) كقاعدة قاطعة.
- طبّق نفس الفلتر على `productInfo.name` الأصلي قبل اعتماده.

### 2) تعبئة الوصف العربي عند فشل AI
بعد كتلة description fallback لـ Bambu، إذا `productInfo.description` ≥ 40 حرف و`productInfo.description_ar` فارغ:
- اعكس النص الإنجليزي إلى `description_ar` مع علامة `[needs translation]` في النهاية حتى لا يُحفظ كنص نهائي مغلوط.
- سجّل `[Extract:bambu] description_ar mirrored from EN`.

### 3) استخراج الأبعاد/الوزن من HTML المنتج
قبل اللجوء لـ web search/AI، أضف parser نصي على `pageContent`:

- بحث case-insensitive عن أنماط:
  - `Net\s*Weight[:\s]*([\d.]+)\s*(kg|g)` → تحويل إلى kg.
  - `Spool\s*(?:Size|Weight)[:\s]*([\d.]+)\s*(kg|g)` كاحتياط.
  - `Dimensions?[:\s]*([\d.]+)\s*[x×]\s*([\d.]+)\s*[x×]\s*([\d.]+)\s*(mm|cm|m)?` → دمج كـ `LxWxH cm`.
  - `Diameter[:\s]*([\d.]+)\s*mm` + `Spool\s*Width[:\s]*([\d.]+)\s*mm` كاحتياط.
- ابحث أيضاً في JSON الـ variant داخل HTML (Bambu يضع `"spec":{...}` أو attribute list). Regex على `"(?:netWeight|weight|dimensions|spoolSize)"\s*:\s*"([^"]+)"`.
- إن وُجد، عبّئ `productInfo.weight_kg` / `productInfo.dimensions` مباشرة، وتجاوز web search.

### 4) hex لون صحيح من بيانات الـ variant
في `parseBambuLabUnified` و/أو `buildBambuVariantImageMap`:

- وسّع الـ regex ليلتقط حقول الـ hex المعلَنة في JSON: `"colorHex"\s*:\s*"#?([0-9a-fA-F]{6})"`, `"propertyHex"\s*:\s*"#?([0-9a-fA-F]{6})"`, `"hex"\s*:\s*"#?([0-9a-fA-F]{6})"` بجانب `propertyValue`.
- ابنِ `Map<normalizedName, hex>` وقدّمها على sampling صورة الـ swatch.
- في النتيجة النهائية: استخدم hex المعلَن إن وُجد، وإلا fallback إلى sampling الحالي. سجّل المصدر لكل لون: `[Extract:bambu] hex source=declared|sampled`.
- أيضاً: في `bambuBaseColorMap` (إن وُجد) أضف ألوان Pure الجديدة (Milky Pink ≈ #F4C7C8 ...) كـ fallback إذا اسم اللون يطابق بدون hex معلَن.

### 5) لمسات تحقق
- `console.log` الحقول النهائية: `name`, `name_ar`, `description_ar.length`, `weight_kg`, `dimensions`, وعدد ألوان بـ hex صحيح.
- بعد deploy: نداء `curl_edge_functions` على نفس الرابط ومراجعة اللوجات للتأكد من أن:
  - `name = "PLA Pure"`.
  - `name_ar = "PLA Pure"` (أو نسخة عربية لاحقاً).
  - `description_ar.length > 0`.
  - `weight_kg ≈ 1`, `dimensions` غير null.
  - كل لون له hex من JSON-LD/JSON variant وليس من sampling.

## ما لن يتغير
- المنطق العام لـ Shopify/Firecrawl/translate-product.
- الواجهة، RLS، migrations.
- استدعاءات AI (تبقى كما هي لأن 402 خارج عن سيطرة الكود — هذه الإصلاحات تجعل الاستخراج صحيحاً بدون AI).

## ملاحظة
الـ AI gateway يرجع 402 (لا توجد كريديتس). الإصلاحات تجعل الـ deterministic path يعطي نتيجة كاملة وصحيحة. لتوليد `benefits/problem_solved/usage` غنية و`description_ar` مترجم فعلياً، أعد شحن كريديتس Lovable AI.
