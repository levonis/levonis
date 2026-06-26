## التشخيص من اللوجات الفعلية للـ edge function

من سجل `extract-product-info` لهذا الرابط تحديداً:

- `Direct extraction - name: PLA Pure - Milky Pink (17200) / Refill / 1kg` → الاسم أُخذ من أول variant بدل اسم المنتج الأصلي "PLA Pure".
- `Bambu unified parser: 5 colors, 3 options, axes=[["Color",1],["__unknown__",5],["Type",1],["Size",1]]` → محور Color الحقيقي فيه variant واحد فقط، و5 variants سقطت في `__unknown__` وتم تصنيفها كألوان بشكل خاطئ. لذلك "الألوان" التي تظهر للمستخدم تبدو فاضية/غلط (بدون hex/صور حقيقية).
- `Direct images:` يحتوي على `Shipping.png`, `14-day_returns.png`, `lifetime_Support.png`, `secure_payment.png` → شارات ثقة دخلت ضمن صور المنتج.
- `AI error: 402 Not enough credits` ثم `Filled ai_content via deterministic fallback` → الوصف الناتج عام/مقطوع لأن الـ AI لم يُستدعَ، والـ fallback الحالي لا يقرأ وصف Bambu المنظم.

## الإصلاحات (محصورة في `supabase/functions/extract-product-info/index.ts`)

### 1) اسم المنتج النظيف لـ Bambu
- بعد direct extraction، إذا `platform === 'bambulab'`، اشتقّ الاسم الأساسي من (بهذا الترتيب): JSON-LD `Product.name` بدون variant، ثم `og:title`/`<title>` بعد إزالة لاحقة المتجر، ثم slug من URL (`pla-pure` → `PLA Pure`).
- اقطع أي لاحقة بعد ` - ` أو ` / ` تحتوي على hex code بين أقواس مثل `(17200)` أو كلمات `Refill|Filament with spool|1 kg|250 g|kg|g`.

### 2) تصفية صور الشارات
داخل cleanup الصور للـ Bambu، أسقط أي URL يحتوي على أحد هذه التوكنز (case-insensitive):
`shipping`, `secure_payment`, `lifetime_support`, `14-day`, `returns`, `warranty_badge`, `payment_methods`. هذه ليست صور منتج.

### 3) تصنيف محاور variants الناقصة (السبب الجذري للألوان الخاطئة)
في `parseBambuLabUnified`، أي variant axis = `__unknown__` يُعاد تصنيفه بقاعدة نصية صارمة:
- يحتوي hex code بأقواس `(\d{4,6})` أو اسم لون معروف من `bambuBaseColorMap` → **Color**.
- يطابق `\b(refill|with spool|filament with spool|spool)\b` → **Type**.
- يطابق `\b(\d+\s?(kg|g|m|meters?))\b` → **Size**.
- خلاف ذلك → يُترك كـ option عام (ليس لون).

ثم: لا تُسجَّل في `colors` إلا variants من محور Color الفعلي. كل الباقي → `options`.

### 4) وصف احتياطي ذكي لـ Bambu عند فشل AI (402)
عند سقوط الـ AI، قبل اللجوء لـ deterministic فاضي:
- استخرج `description` من JSON-LD Product، أو من `<meta name="description">`/`og:description`، أو من أول `<div class="product-description"|"rte"|"product__description">` في HTML الـ Firecrawl.
- إذا وُجد نص ≥ 80 حرف، استخدمه كوصف إنجليزي، وضع نسخة عربية مختصرة مترجمة من نفس الحقول مع علامة `[needs review]` حتى لا يُحفظ كنص عام خاطئ.
- لا تخترع `problem_solved`/`benefits` بدون مصدر — اتركها فارغة بدل ملئها بنص قالبي.

### 5) تحقق
- نشر `extract-product-info` ثم نداء `curl_edge_functions` على نفس الرابط.
- التحقق من اللوجات: اسم = "PLA Pure"، صور ≥ 5 بدون أي شارة، `axes` يظهر Color الحقيقي، `colors` = ألوان حقيقية فقط، `options` تحتوي Refill/With Spool و1kg/250g، الوصف غير فارغ ومن المصدر.

## ملاحظة مهمة
الـ AI رجع 402 (لا توجد كريديتس كافية على بوابة Lovable AI). الإصلاحات أعلاه تجعل الاستخراج يعطي نتيجة صحيحة حتى بدون AI، لكن لتفاصيل أعمق (benefits/problem_solved) ستحتاج لإعادة شحن كريديتس AI gateway. أكمل بدونها الآن.

## ما لن يُلمس
لن أعدل: المنطق العام للـ Shopify، Firecrawl، translate-product، الواجهة، أو RLS/migrations. التغيير محصور بملف edge واحد.
