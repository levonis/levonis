## الخطة

سأصلح مسار إعادة الاستخراج بحيث لا تبقى حقول SEO والملخص القصير فارغة عند تعديل منتج موجود.

### 1) إصلاح استدعاء AI داخل دالة الاستخراج
- تحديث `extract-product-info` لاستخدام نمط Lovable AI الصحيح داخل Edge Function.
- استبدال ترويسة `Authorization: Bearer` الحالية بترويسة Lovable AI المطلوبة، لأن فشل نداء SEO الاحتياطي يؤدي لبقاء الحقول فارغة.
- جعل الاستجابة تسجل وجود `short_summary` و `searchable_tags` و `ai_content` في نهاية الاستخراج لتسهيل التحقق لاحقاً.

### 2) ضمان fallback محلي لا يترك SEO فارغاً
- إضافة fallback حتمي لا يملأ `short_summary` فقط، بل يملأ أيضاً:
  - `searchable_tags`
  - `ai_content.problem_solved`
  - `ai_content.target_audience`
  - `ai_content.benefits`
  - `ai_content.usage`
  - `ai_content.specifications`
- سيعتمد fallback على اسم المنتج والوصف الحالي إذا فشل AI أو لم يرجع JSON صالح.

### 3) إصلاح تعبئة الواجهة للمنتج الموجود
- تعديل `applyProductInfo` في `Admin.tsx` ليقبل أسماء الحقول المحتملة من السيرفر:
  - `searchable_tags`
  - `searchable_attributes`
- عند الضغط على "تحديث" أو "إعادة الاستخراج"، سيتم تحديث state الخاص بالملخص/SEO مباشرة حتى تظهر القيم في الحقول بدون انتظار حفظ أو إعادة فتح النافذة.

### 4) التحقق
- أتحقق أن استجابة الاستخراج تحتوي فعلياً على `short_summary` وبيانات SEO.
- أتحقق أن الواجهة تملأ الحقول للمنتج الموجود بدلاً من تركها فارغة.