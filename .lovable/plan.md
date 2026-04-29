## ما تبقّى لإكمال نظام فوائد باقات الحماية

البنية التحتية جاهزة (DB + RPCs + الـ hook المُدمج + استدعاء RPC الصحيح في Cart). يبقى **واجهة الأدمن** + **عرض المصدر للمستخدم**.

### 1. صفحة أدمن جديدة لتحرير فوائد كل باقة

**ملف جديد:** `src/pages/AdminProtectionPlanBenefits.tsx`

- يجلب كل صفوف `protection_plans` (مرتّبة حسب `display_order`).
- لكل باقة بطاقة فيها الحقول الـ 7 الجديدة:
  - `benefit_discount_percentage` (نسبة %)
  - `benefit_discount_max_amount_monthly` (حد أقصى شهري بالدينار)
  - `benefit_free_shipping_max_monthly` (عدد مرات الشحن المجاني/شهر)
  - `benefit_free_shipping_min_order` (حد أدنى للطلب)
  - `benefit_free_shipping_methods` (checkboxes: standard/personal/pickup)
  - `benefit_discount_category_ids` (multi-select للأقسام — فارغ = الكل)
  - `benefit_free_shipping_category_ids` (نفس الشيء للشحن)
- زر "حفظ" يُحدّث الصف عبر `update().eq('id', plan.id)`.
- نسخة طبق الأصل من واجهة `AdminPrinterWarrantyBenefits.tsx` (نفس الـ `CategoryMultiSelect` و الـ `DEFAULT_METHODS`) لاتساق التجربة.

### 2. ربطها بالتنقّل

- **`src/App.tsx`**: إضافة `lazy` import + Route تحت `${ADMIN_BASE_PATH}/protection-plan-benefits` (محمي بـ `AdminRoute`).
- **`src/pages/AdminPrinterProtection.tsx`**: زر "إعدادات فوائد الباقات" بجانب أزرار إدارة الباقات الحالية يُوجّه إلى المسار الجديد.

### 3. عرض مصدر الفائدة للمستخدم

**`src/components/WarrantyBenefitsCard.tsx`**: عند `warrantyBenefits.source === 'subscription'` أعرض شارة صغيرة "باقة الحماية: {planNameAr}" بدلاً من "ضمان الطابعة". لا تغيير في الأرقام أو المنطق — فقط النص/الشارة.

### 4. تحديث الذاكرة

تحديث `mem://features/hardware/warranty-loyalty-benefits` لتذكر أن الفوائد تُجمَع من مصدرين (`printer_warranty_benefits` + `protection_plans.benefit_*`) و `useCartWarrantyBenefits` يختار الأفضل تلقائياً، و Cart يستدعي الـ RPC المناسب (`consume_warranty_benefit` أو `consume_subscription_benefit`).

### بعد التطبيق — كيف يضبط الأدمن المثال الذي طلبته

من صفحة `/cp-x9A3kL7m/protection-plan-benefits`:

- **الباقة 1 (basic):** خصم 10% / حد 10,000 د.ع / شحن مجاني 1 شهرياً / حد أدنى 100,000 / `standard` فقط / قسم PLA فقط.
- **الباقة 2 (standard):** خصم 10% / حد أعلى / شحن مجاني 5 مرات شهرياً / نفس الشروط.

كل اشتراك يطبّق فوائده تلقائياً في السلة، ويُسجَّل الاستخدام في `subscription_benefit_usage` ليعيد الضبط شهرياً.

### الملفات المتأثرة

- جديد: `src/pages/AdminProtectionPlanBenefits.tsx`
- تعديل: `src/App.tsx`، `src/pages/AdminPrinterProtection.tsx` (زر فقط)، `src/components/WarrantyBenefitsCard.tsx`
- تحديث: `mem://features/hardware/warranty-loyalty-benefits`