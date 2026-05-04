
## الهدف

تبسيط `/cp-x9A3kL7m/random-filament` إلى **تبويبتين فقط**:
1. **العروض** (إضافة/تعديل/حذف بنموذج كامل)
2. **المحظورون** (رفع الحظر + سبب الحظر)

وتحسين تجربة الإضافة، ودقة المخزون، وتنبيه "انتهى العرض" عند عدم توفر منتجات بيع مباشر.

---

## 1) صفحة الإدارة الجديدة

### إزالة:
- تبويب **الإعدادات** (تفعيل/تعطيل + عنوان/وصف + قائمة الأقسام).
- تبويب **الطلبات**.
- بطاقات الإحصائيات في الـ Hero (تُختصر أو تُحذف).

### إبقاء وتحويل الإعدادات لمستوى العرض:
- التفعيل العام للقسم وقائمة الأقسام الفرعية المسموحة سيُديرها كل **عرض** بنفسه (يحدد أقسامه الفرعية)، مع switch واحد بسيط أعلى الصفحة لتفعيل/تعطيل القسم بالكامل (chip صغير في الـ header، يحفظ مباشرة).

### تبويب 1: **العروض**
- زر علوي واحد: **إضافة عرض جديد** يفتح Dialog (نموذج موحد للإضافة والتعديل).
- قائمة العروض مقسمة بصرياً: **بيع مباشر** و **حجز مسبق**.
- كل بطاقة عرض تعرض:
  - الصورة + العنوان + السعر + عدد المنتجات المرتبطة + عدد الأقسام الفرعية.
  - **مؤشر مخزون مباشر**: مجموع `stock_quantity` للخيارات المتاحة (`available_for_direct_sale=true AND stock_quantity > 0`) عبر كل المنتجات المرتبطة. إذا = 0 ⇒ شارة حمراء **"انتهى العرض"** مع تعطيل تلقائي للعرض.
  - **عداد المبيعات**: عدد صفوف `random_filament_orders` المرتبطة بهذا `offer_id` حيث `order_id IS NOT NULL`.
  - أزرار: تعديل / حذف / تفعيل-تعطيل.

### تبويب 2: **المحظورون**
- بطاقة لكل محظور: المعرّف، اسم/إيميل المستخدم (Join مع `profiles`)، **سبب الحظر**، تاريخ الحظر، وزر **رفع الحظر**.

---

## 2) Dialog إضافة/تعديل عرض (موحد)

حقول النموذج بترتيب التعبئة:

1. **الاسم (عربي)** — `title_ar`
2. **السعر (د.ع)** — `price_iqd`
3. **رفع صورة** — Input من نوع file، يرفع إلى Supabase Storage (bucket `product-images` أو `random-filament` إن وُجد) ويحفظ URL في `image_url`. يدعم المعاينة قبل الحفظ.
4. **الوصف (اختياري)** — `description_ar`
5. **نوع البيع** — Radio: بيع مباشر / حجز مسبق
6. **القسم الرئيسي** — Select من `main_sections` (للتصفية فقط؛ افتراضياً مواد الطباعة).
7. **الأقسام الفرعية (متعدد)** — Checkboxes من `categories` تحت القسم الرئيسي المختار. **تغيير في الـ schema**: استبدال `category_id uuid` بـ `category_ids uuid[]` على `random_filament_offers`.
8. **المنتجات (متعدد)** — قائمة بالمنتجات الموجودة في الأقسام الفرعية المختارة فقط:
   - **في حالة بيع مباشر**: تعرض فقط المنتجات التي تحوي خياراً واحداً على الأقل بـ `available_for_direct_sale=true AND stock_quantity > 0`. كل منتج يعرض بجواره مخزونه المتاح.
   - **في حالة حجز مسبق**: تعرض كل المنتجات (مع `available_for_pre_order` افتراضياً true).
   - دعم اختيار متعدد عبر أكثر من قسم فرعي.

زر **حفظ** يُنشئ/يُحدّث الصف ثم يقفل الـ Dialog.

---

## 3) تغييرات قاعدة البيانات

### Migration A — توسيع جدول العروض:
```sql
ALTER TABLE public.random_filament_offers
  ADD COLUMN category_ids uuid[] NOT NULL DEFAULT '{}';

-- ترحيل القيم القديمة من category_id إلى category_ids
UPDATE public.random_filament_offers
   SET category_ids = ARRAY[category_id]
 WHERE category_id IS NOT NULL AND array_length(category_ids,1) IS NULL;
```
- **لا** نحذف `category_id` فوراً (لتفادي كسر RPC القديمة)؛ نهمل استخدامه في الواجهة الجديدة، وبعد تحديث الـ RPC نتجاهل القيمة.

### Migration B — تحديث RPC `create_random_filament_order`:
- يقبل نفس البارامترات `(p_category_id, p_offer_id)`.
- التحقق يصبح: `p_category_id = ANY(v_offer.category_ids)` بدل `v_offer.category_id`.
- اختيار المنتج العشوائي: من `allowed_product_ids` المتقاطعة مع منتجات الفئة المختارة (أو كل القسم الفرعي إن كانت `allowed_product_ids` فارغة وكان للعرض أقسام محددة).
- **بيع مباشر**: شرط `available_for_direct_sale=true AND stock_quantity > 0` كما هو، مع `FOR UPDATE SKIP LOCKED` لقفل الخيار.
- **خصم المخزون**: `UPDATE product_options SET stock_quantity = stock_quantity - 1 WHERE id = v_option.id` (لا يحدث حالياً).
- إذا فشل اختيار منتج/خيار في البيع المباشر ⇒ `NO_PRODUCT_AVAILABLE` (الواجهة تترجم لـ "انتهى العرض").

### Migration C — RPC جديدة `rf_offer_stock_summary(offer_id)`:
ترجع `{ direct_stock_total, sales_count }` — تستخدمها بطاقة العرض لعرض المؤشرين بدون N+1.

### Storage:
استخدام bucket موجود (مثل `product-images`) لرفع صور العروض، أو إنشاء bucket عام `random-filament-offers` بسياسات: قراءة عامة + كتابة للأدمن فقط.

---

## 4) واجهة `/random-filament` (المستخدم)

تحديث طفيف فقط:
- استعلام العروض يستخدم `category_ids` بدل `category_id` (`.contains('category_ids', [categoryId])`).
- إذا أرجعت RPC `NO_PRODUCT_AVAILABLE` على عرض بيع مباشر، نعرض رسالة "انتهى هذا العرض" بدلاً من رسالة عامة، ونُبطل الكرت في القائمة.

---

## 5) الملفات المتأثرة

- `src/pages/AdminRandomFilament.tsx` — إعادة كتابة شبه كاملة (تبويبتان + Dialog موحد + رفع صورة + اختيار أقسام/منتجات متعدد + بطاقات بمخزون ومبيعات).
- `src/pages/RandomFilament.tsx` — تكييف استعلام العروض على `category_ids` ومعالجة "انتهى العرض".
- Migration SQL جديد لكل من: `category_ids`, تحديث `create_random_filament_order` (مع خصم المخزون), دالة `rf_offer_stock_summary`, وسياسة Storage إن لزم.

---

## 6) ملاحظات تقنية

- **حساب المبيعات** = `count(random_filament_orders WHERE offer_id = X AND order_id IS NOT NULL)` (فقط المدفوعة).
- **مخزون البيع المباشر** يُحسب على مستوى `product_options.stock_quantity` (مصدر الحقيقة) لجميع المنتجات في `allowed_product_ids` للعرض، مع `available_for_direct_sale=true`.
- **خصم المخزون** يحدث داخل الـ RPC ضمن ترانزاكشن واحد مع قفل الصف، لتفادي البيع المضاعف.
- جميع النصوص بالعربية وفق سياسة المشروع (مع إمكانية إضافة مفاتيح i18n لاحقاً).
- التصميم يتبع Glassmorphism Professional الموجود.
