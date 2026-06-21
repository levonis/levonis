## ميزة اقتراح طابعة (Printer Advisor)

نضيف زر "اقترح لي طابعة" في صفحة قسم الطابعات يفتح Dialog بسيط فيه:
- حقل الميزانية (بصيغة IQD مع فاصلة آلاف تلقائية، ويضرب × 1000 إذا كتب المستخدم رقم صغير مثل "500" → "500,000").
- حقل الغرض (Textarea) + شرائح اختيار سريعة (هواية، تعليمي، احترافي، أعمال صغيرة، نماذج معدنية، طباعة كبيرة...).
- مستوى الخبرة (مبتدئ / متوسط / محترف).
- زر "اقترح لي الأنسب".

النتيجة: بطاقة الطابعة المقترحة + شرح "لماذا هي الأنسب" بالعربي + 3-5 مميزات + رابط للذهاب لصفحة المنتج. وإذا كانت ميزانيته قريبة من طابعة أعلى يقترحها الـ AI بصيغة "ننصح بتزويد X د.ع للحصول على...".

### 1) قاعدة البيانات
- إضافة عمودين على `products`:
  - `advisor_priority_boost` integer DEFAULT 0 (يستخدمه الأدمن لرفع/خفض ترتيب الطابعة في الاقتراحات).
  - `advisor_recommended` boolean DEFAULT false (علم "موصى به").
  - `advisor_notes` text (ملاحظة من الأدمن للـ AI: "هذه الأفضل للمبتدئين"، تُمرر للنموذج).
- جدول جديد `printer_advisor_budget_rules`:
  - `id`, `min_budget_iqd`, `max_budget_iqd`, `recommended_product_id` (FK → products), `upgrade_suggestion_product_id` (FK اختياري), `message_ar`, `priority`, `is_active`, timestamps.
  - RLS: قراءة عامة، كتابة admin فقط، GRANTs للأدوار المطلوبة.

### 2) Edge Function: `suggest-printer`
- يأخذ: budget_iqd, purpose, experience_level.
- يجلب من قاعدة البيانات قائمة الطابعات (تصنيف الطابعات فقط) بأسعارها بعد تحويل العملة الموحد المستخدم في الموقع، مع `advisor_priority_boost`, `advisor_recommended`, `advisor_notes`.
- يطبق `printer_advisor_budget_rules` أولاً (قاعدة صريحة تطغى).
- يرسل للـ AI (Lovable AI Gateway → `google/gemini-2.5-pro`) مع system prompt عربي يحتوي قائمة الطابعات المتاحة + الميزانية + الغرض ويطلب structured output:
  ```
  { recommended_product_id, reasoning, key_features[], upgrade_suggestion?: { product_id, additional_budget_iqd, message } }
  ```
- يرجّع الـ JSON مع بيانات المنتج الكاملة (اسم، صورة، سعر، رابط).

### 3) الواجهة - Dialog
- ملف جديد `src/components/printer-advisor/PrinterAdvisorDialog.tsx`:
  - Glassmorphism حسب معايير المشروع.
  - Input للميزانية يستخدم `FormattedNumberInput` (موجود) مع منطق إضافي onBlur: إذا الرقم < 10000 يضربه × 1000 ويعرض toast صغير "تم تحويل المبلغ تلقائياً إلى X د.ع".
  - شرائح اختيار الغرض (chips قابلة للاختيار المتعدد).
  - حالات: idle / loading (skeleton) / result / error.
  - عرض النتيجة: بطاقة منتج + سبب + مميزات + CTA "اذهب للمنتج" + (إن وجد) كرت ترقية الميزانية.
- زر إطلاق الـ Dialog: نضيفه في `src/pages/ProductShop.tsx` (صفحة الطابعات) أعلى الصفحة، بشكل بارز.

### 4) لوحة الأدمن
- في `AdminProductPricingSection.tsx` (قسم منتج الأدمن): إضافة 3 حقول جديدة في تبويب فرعي "مستشار الطابعات":
  - Switch "موصى به في المستشار".
  - Input رقمي "أولوية الترتيب" (-100 إلى +100).
  - Textarea "ملاحظة للمستشار" (تُمرر للـ AI كسياق).
- صفحة جديدة `src/pages/AdminPrinterAdvisorRules.tsx` (مسار `/admin/printer-advisor-rules`):
  - جدول CRUD لقواعد الميزانية: نطاق المبلغ، الطابعة الموصى بها، طابعة الترقية، رسالة مخصصة.
  - إضافة رابط في قائمة الأدمن.

### تفاصيل تقنية
- مفتاح `LOVABLE_API_KEY` موجود (Lovable AI Gateway). لا حاجة لمفتاح خارجي.
- نموذج: `google/gemini-2.5-pro` مع Structured Output (Zod schema).
- جلب الأسعار: نستخدم نفس منطق `computeUnifiedCardPrice` لضمان التطابق مع بطاقات المنتج.
- تحويل "500" → "500,000": يحدث فقط للأرقام < 10000 على blur (لمنع تعديل أرقام صحيحة كبيرة).
- i18n: نصوص ar/en/ku عبر ملفات اللغة الموجودة، بدون hardcoded text.

### الملفات المعدّلة/المضافة
- migration جديدة (أعمدة + جدول + RLS + GRANTs).
- `supabase/functions/suggest-printer/index.ts` (جديد).
- `src/components/printer-advisor/PrinterAdvisorDialog.tsx` (جديد).
- `src/pages/ProductShop.tsx` (إضافة زر).
- `src/components/admin/AdminProductPricingSection.tsx` (3 حقول جديدة).
- `src/pages/AdminPrinterAdvisorRules.tsx` (جديد) + إضافة Route + رابط في قائمة الأدمن.
- ملفات اللغة `src/lib/i18n/*` (إضافة مفاتيح).