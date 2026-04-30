# تطوير صفحة التاجر `/store/:merchantId`

## الهدف
1. جعل خلفية صفحة التاجر زجاجية شفافة (Glassmorphism) افتراضياً.
2. السماح للتاجر بتخصيص الخلفية (لون / تدرّج / صورة) من إعدادات المتجر.
3. إخفاء الـ Dynamic Island تماماً عند فتح صفحة التاجر.

## الملفات والتغييرات

### 1. قاعدة البيانات — Migration جديد
إضافة 3 أعمدة لجدول `merchant_applications`:
- `store_background_type TEXT DEFAULT 'glass'` — القيم: `glass` | `color` | `gradient` | `image`
- `store_background_value TEXT NULL` — لون hex، أو CSS gradient، أو URL صورة
- `store_background_blur INT DEFAULT 20` — شدة الـ blur (0-40px) للطبقة الزجاجية فوق الخلفية

### 2. إخفاء الجزيرة على صفحة المتجر
**`src/island/IslandContext.tsx`** — إضافة `/store` و `/community/store` و `/community/merchant/store` إلى `HIDDEN_PREFIXES`.

### 3. خلفية Glassmorphism + خلفية مخصصة
**`src/pages/CommunityMerchantStorePage.tsx`**:
- استبدال `min-h-screen bg-background` بحاوية تحتوي على:
  - طبقة خلفية (`fixed inset-0 -z-10`) تعرض اللون/التدرج/الصورة المختارة من بيانات التاجر، وعند `glass` تعرض تدرجاً ناعماً افتراضياً يستخدم لون الـ primary.
  - المحتوى فوقها بـ `relative` + بطاقات `glass-panel` / `glass-tile` (متّبعة معيار Glassmorphism Professional من ذاكرة المشروع).
- جلب الحقول الجديدة ضمن استعلام بيانات التاجر.

### 4. واجهة التخصيص في الإعدادات
**`src/components/merchant/StoreProfileEditor.tsx`** — إضافة قسم جديد "خلفية المتجر" يحوي:
- 4 تبويبات: زجاجي (افتراضي) / لون موحد / تدرّج / صورة.
- منتقي لون (`<input type="color">`) للوضعين color/gradient (لونان للتدرج).
- رفع صورة الخلفية إلى bucket `store-assets` (موجود) مع معاينة.
- شريط تمرير لشدّة الـ blur الأمامي (10-40px).
- معاينة مباشرة Live Preview أعلى القسم.
- حفظ الحقول الثلاثة الجديدة عند الضغط على "حفظ".

### 5. مكوّن مساعد جديد
**`src/components/merchant/StoreBackgroundLayer.tsx`** — مكوّن صغير يستقبل `{ type, value, blur }` ويُصدر طبقة `fixed inset-0 -z-10` مع غلاف زجاجي (`backdrop-blur-[var]`, طبقة شفافة بلون الخلفية) لضمان قراءة النصوص.

## ملاحظات
- يتم تطبيق الخلفية فقط على صفحة التاجر، ولا يؤثر على باقي التطبيق.
- الزائرون يرون نفس التخصيص؛ المالك فقط يستطيع تعديله من زر الإعدادات الموجود.
- لا حاجة لتغييرات في `MerchantStandalone.tsx` لأنه يستخدم نفس `CommunityMerchantStorePage` داخلياً (سيرث التخصيص تلقائياً).
- متوافق مع ذاكرة المشروع: Glassmorphism Professional Standard، i18n (لا نصوص ثابتة بلغة واحدة في إعدادات الواجهة).
