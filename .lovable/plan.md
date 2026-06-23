## ترقية نموذج استخراج المنتجات

### التغيير
ترقية النموذج المستخدم في `supabase/functions/extract-product-info/index.ts` من `google/gemini-3.1-pro-preview` إلى `openai/gpt-5.5` لكل عمليات الاستخراج.

### التفاصيل التقنية
- في `supabase/functions/extract-product-info/index.ts` (السطر 6):
  - `LOVABLE_AI_MODEL = 'openai/gpt-5.5'`
- مراجعة جميع استدعاءات `fetch` للـ AI Gateway للتأكد من توافق body مع GPT-5.5 (إزالة أي معاملات Gemini-specific مثل `thinkingConfig` إن وُجدت، والإبقاء فقط على `model`, `messages`, `tools`/`response_format`).
- إعادة نشر الـ edge function بعد التعديل.

### ملاحظة على التكلفة
GPT-5.5 أعلى تكلفة وأبطأ قليلاً من Gemini 3.1 Pro، لكنه أقوى في دقة الاستخراج المنظم (colors/options/specs).

### التحقق
استدعاء الـ function بالرابط الذي ذكرته سابقاً (BIQU CryoGrip) والتأكد أن Type يذهب لـ options و Print Size يذهب لـ colors بدون أخطاء.