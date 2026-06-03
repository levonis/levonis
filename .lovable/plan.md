## نظرة عامة
إضافة "تأمين إضافي" دفعة واحدة (12 أو 24 شهر) للطابعات، يُضاف من السلة كسطر منفصل لكل طابعة ضمن نفس مجموعة المنتجات، ومتاح أيضاً في `/printer-protection`. السعر = نسبة مئوية من سعر الطابعة يحددها الادمن. التفعيل مشروط بامتلاك بطاقة Levo فعالة في `user_cards`.

## 1) قاعدة البيانات (migration)

توحيد الباقات في `protection_plans` بإضافة حقول جديدة بدل نظام مستقل:
- `coverage_months int` (12 أو 24) — null للباقات الشهرية الحالية
- `price_percentage numeric` — نسبة من سعر الطابعة (مثلاً 8.00 لـ 8%)
- `is_addon_insurance boolean default false` — لتمييز باقات التأمين الإضافي عن الاشتراك الشهري
- `requires_active_card boolean default true`

جدول جديد `cart_insurance_addons`:
- `id`, `user_id`, `cart_item_id` (fk + cascade), `plan_id` (fk protection_plans), `printer_product_id`, `coverage_months`, `price_iqd` (مُخزَّن وقت الإضافة), `created_at`
- UNIQUE(cart_item_id) — تأمين واحد فقط لكل سطر سلة طابعة
- RLS: المالك فقط + service_role + GRANT للـ authenticated

عند تحويل السلة إلى طلب، تُنشأ `printer_subscriptions` بعدد = quantity للطابعة، حالة `pending_activation` حتى تأكيد الطلب، ثم تُفعّل تلقائياً بعد التسليم (trigger أو edge function).

## 2) لوحة الادمن `/printer-protection-admin`

إضافة تبويب جديد "باقات التأمين الإضافي" يحوي:
- إنشاء/تعديل/حذف باقات بـ `is_addon_insurance=true`
- حقول: الاسم بـ 3 لغات، coverage_months (12/24)، price_percentage، الفئات المؤهلة (categories متعددة)، حد أدنى/أعلى للسعر، نص الشرح للنافذة المنبثقة، حالة نشط/معطل

## 3) السلة `Cart.tsx` + `GroupedCartItem.tsx`

داخل كل مجموعة طابعة:
- زر "🛡️ أضف تأمين إضافي" + أيقونة (i) صغيرة تفتح `InsuranceInfoDialog` (شرح + شروط)
- عند الضغط: `AddInsuranceDialog` يعرض الباقات المتاحة (12/24 شهر) بالسعر المحسوب من سعر الطابعة الفعلي
- التحقق:
  - وجود `user_cards` نشطة → وإلا CTA "احصل على بطاقة Levo" يوجه `/membership-cards`
  - المنتج في فئة طابعات مؤهلة
- عند الإضافة: insert في `cart_insurance_addons` (للسطر فقط)؛ السعر يتضاعف تلقائياً مع `quantity` عبر hook `useCartInsurance` الذي يضرب `price_iqd × quantity`
- يظهر سطر فرعي تحت الطابعة: "🛡️ تأمين إضافي 12 شهر × N = X د.ع" مع زر حذف
- إجمالي السلة + checkout يضيف مجموع التأمين كبند مستقل

Hook جديد `useCartInsurance(items)` يجلب الإضافات ويحسب الإجمالي + يبثها لـ Cart للـ totals.

## 4) صفحة `/printer-protection`

إضافة Tab "تأمين إضافي" بجانب الباقات الشهرية الحالية:
- يعرض بطاقات الـ 12 و24 شهر
- اختيار طابعة من طابعات المستخدم → عرض السعر المحسوب → دفع من المحفظة أو COD
- نفس شرط بطاقة Levo النشطة، مع نفس InsuranceInfoDialog

## 5) مكونات جديدة

- `src/components/insurance/InsuranceInfoDialog.tsx` — نافذة شرح (ما يغطيه التأمين، الشروط، مدة الصلاحية، شرط بطاقة Levo)
- `src/components/insurance/AddInsuranceDialog.tsx` — اختيار 12/24 شهر داخل السلة
- `src/components/insurance/CartInsuranceLineItem.tsx` — عرض السطر تحت الطابعة
- `src/hooks/useActiveLevoCard.ts` — يتحقق من `user_cards` نشطة
- `src/hooks/useCartInsurance.tsx` — جلب/إضافة/حذف + total

## 6) i18n

إضافة المفاتيح في `src/lib/i18n/{ar,en,ku}.ts`:
- `insurance.addExtra`, `insurance.12months`, `insurance.24months`, `insurance.requiresLevoCard`, `insurance.dialogTitle`, `insurance.dialogContent`, إلخ.

## 7) قواعد قائمة بالفعل تُحترم

- منع خلط فئات السلة: التأمين ليس سطر سلة منفصل بل ملحق لسطر طابعة موجود، لذا لا يكسر `getCartCategories`
- Glassmorphism في كل النوافذ
- `price_adjustment` IQD مباشرة (السعر مُخزَّن مرة واحدة وقت الإضافة)
- استخدام `modal={true}` للحوارات المتداخلة داخل Cart

## الملفات

**جديدة:**
- migration واحد
- `src/components/insurance/InsuranceInfoDialog.tsx`
- `src/components/insurance/AddInsuranceDialog.tsx`
- `src/components/insurance/CartInsuranceLineItem.tsx`
- `src/hooks/useActiveLevoCard.ts`
- `src/hooks/useCartInsurance.tsx`

**معدَّلة:**
- `src/pages/Cart.tsx` (إجمالي + تمرير hooks)
- `src/components/GroupedCartItem.tsx` (زر التأمين + سطر فرعي + نافذة شرح)
- `src/pages/PrinterProtection.tsx` (تبويب جديد)
- `src/pages/AdminPrinterProtection.tsx` (تبويب إدارة باقات التأمين)
- ملفات i18n الثلاثة

## مخاطر/ملاحظات
- خصومات/تأمين موجود (`useCartProtectionDiscount`) منفصل ولا يتعارض
- عند تغيير `quantity` للطابعة، التأمين يُحسب تلقائياً × quantity (لا insert إضافي)
- عند حذف سطر الطابعة من السلة، يُحذف التأمين بـ ON DELETE CASCADE
