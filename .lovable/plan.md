## الهدف

كل باقة حماية (`protection_plans`) ستحمل إعداداتها الخاصة لـ:

1. **خصم النسبة المئوية** + حد أقصى شهري بمبلغ ثابت (مثلاً 10% بحد 10,000 د.ع/شهر)
2. **عدد مرات الشحن المجاني الشهرية** (1 للباقة الأساسية، 5 للباقة المتقدمة)
3. **شروط الشحن المجاني**:
   - حد أدنى لقيمة الطلب (مثل 100,000 د.ع)
   - طرق التوصيل المسموحة فقط (مثل `standard` فقط، بدون `personal`)
   - الأقسام المسموحة فقط (مثل PLA فقط)
4. **الأقسام المؤهلة للخصم** (whitelist)

عند الشراء سيتم تطبيق فوائد **كل طابعة مشتركة على حدة** (الطابعة المؤمَّنة بالباقة 1 تحصل على فوائد الباقة 1، والمؤمَّنة بالباقة 2 تحصل على فوائد الباقة 2). إذا كان للمستخدم أكثر من اشتراك يغطي نفس البند تُختار الفائدة الأفضل لكل بند (best-of) كما هو حالياً مع ضمان الشراء.

## التصميم

```text
protection_plans (يضاف إليها الأعمدة)
   ├─ benefit_discount_percentage          numeric
   ├─ benefit_discount_max_amount_monthly  numeric
   ├─ benefit_discount_category_ids        uuid[]
   ├─ benefit_free_shipping_max_monthly    integer
   ├─ benefit_free_shipping_min_order      numeric
   ├─ benefit_free_shipping_methods        jsonb (مثل ["standard"])
   └─ benefit_free_shipping_category_ids   uuid[]

printer_subscriptions (status='active' + ضمن فترة الاشتراك)
   ↓
get_active_subscription_benefits_for_user(user)
   ↓ يرجّع صفّاً لكل اشتراك نشط مع:
       - user_printer_id, plan_id
       - الإعدادات الكاملة من plan
       - الاستخدام الشهري الحالي (discount_used / free_shipping_used)
   ↓
useCartWarrantyBenefits (موجود) + useCartSubscriptionBenefits (جديد)
   ↓ يطبّقان نفس المنطق ويأخذان best-of
```

## خطوات التنفيذ

### 1. قاعدة البيانات (هجرة)

- إضافة الأعمدة الجديدة إلى `protection_plans` (كلها NULL/0 افتراضياً للحفاظ على التوافق).
- إنشاء جدول جديد `subscription_benefit_usage` (مثل `printer_warranty_usage` تماماً) يربط `subscription_id` + `user_printer_id` + `order_id` + `benefit_type` + `saved_amount` + `delivery_method_key`.
- إنشاء RPC `get_active_subscription_benefits_for_user(p_user_id)` يرجّع لكل اشتراك نشط (`status='active'` و `start_date <= now() < end_date OR end_date IS NULL`):
  - بيانات الطابعة (model + category_id) + بيانات الباقة الكاملة + المستخدم الشهري الحالي.
- ترحيل خفيف: نسخ القيم الحالية الافتراضية للباقات الموجودة (يبقى المستخدم يضبطها من لوحة الأدمن).

### 2. لوحة الأدمن

في `src/pages/AdminPrinterProtection.tsx` (إدارة الباقات) إضافة قسم "فوائد الباقة" داخل تحرير كل باقة، بنفس واجهة `AdminPrinterWarrantyBenefits.tsx` الموجودة:
- حقل النسبة + حقل الحد الأقصى الشهري + اختيار الأقسام
- حقل عدد مرات الشحن المجاني + حد أدنى للطلب + اختيار طرق التوصيل المسموحة (checkboxes: standard / pickup / personal) + اختيار الأقسام المؤهلة

### 3. تطبيق الفوائد في السلة

- إنشاء `src/hooks/useCartSubscriptionBenefits.tsx` (مرآة لـ `useCartWarrantyBenefits`) يقرأ من RPC الجديد ويحسب نفس النتيجة (`SubscriptionBenefitsResult`).
- في `src/hooks/useCart.tsx` أو حيث يتم تجميع الفوائد: ضمّ نتائج الاثنين واختيار **الأفضل لكل بند** (الخصم بالنسبة، عدد الشحن المجاني، شروطه).
- بقاء قاعدة "الشحن المجاني للتوصيل العادي فقط" مُحقَّقة عبر `freeShippingMethods` (الموجودة فعلاً في فحص السلة) — فقط نتأكد أن طرق التوصيل المختلفة `standard`/`personal`/`pickup` تطابق ما في السلة.
- بقاء قاعدة "الحد الأدنى للطلب" مُحقَّقة عبر `freeShippingMinOrder` (موجودة).

### 4. تسجيل الاستخدام عند إنشاء الطلب

- في مسار checkout/إنشاء الطلب (نفس الموضع الذي يُسجَّل فيه `printer_warranty_usage`) إضافة كتابة موازية إلى `subscription_benefit_usage` عند تطبيق فوائد اشتراك.

### 5. واجهة المستخدم

- تحديث `src/components/WarrantyBenefitsCard.tsx` (وما يستخدمها في `Cart`/`Checkout`) لتعرض مصدر الفائدة: "ضمان الطابعة" أو "باقة الحماية: Standard"، مع شارة الباقة.
- تحديث `src/pages/PrinterProtection.tsx` و `InsuranceSection.tsx` ليُظهرا في كل باقة قائمة الفوائد المُحدَّثة (الخصم + الشحن المجاني + الأقسام).

### 6. الذاكرة والتوثيق

- تحديث `mem://features/hardware/warranty-loyalty-benefits` لتذكر أن الفوائد تأتي من مصدرين (ضمان الشراء + اشتراك الحماية) وأن `best-of` يُطبَّق لكل بند.

## ملاحظات مهمة (تقنية)

- لا حاجة لتغيير منطق الشحن في السلة جذرياً — الشروط (طريقة + حد أدنى + أقسام) موجودة في `useCartWarrantyBenefits` ومُختبرة. سنعيد استخدام نفس البنية.
- استراتيجية best-of تُحسب لكل طابعة على حدة ثم تجمع: `max(discount_percentage)`, `max(free_shipping_remaining)` مع احترام شروطها.
- `subscription_benefit_usage.subscription_id` يُتيح عرض إحصائيات الاستخدام لكل اشتراك في صفحة المستخدم لاحقاً.
- لا تغيير في طريقة دفع الاشتراك أو RPC `purchase_printer_subscription` — فقط الفوائد المُطبَّقة بعد الاشتراك.

## الملفات المتأثرة

- جديد: migration SQL، `src/hooks/useCartSubscriptionBenefits.tsx`
- تعديل: `src/pages/AdminPrinterProtection.tsx`، `src/hooks/useCart.tsx` (دمج الفوائد)، `src/components/WarrantyBenefitsCard.tsx`، `src/pages/PrinterProtection.tsx`، `src/components/rewards/InsuranceSection.tsx`، `src/pages/Checkout*.tsx` (تسجيل الاستخدام)، `src/lib/i18n/{ar,en,ku,types}.ts`