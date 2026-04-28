## Goal
بعد ما يفعّل المستخدم الضمان لطابعته من `PrinterActivationPanel`، نعرض له بطاقة CTA واضحة لتفعيل **بطاقة تأمين (Protection Plan)** على نفس الطابعة، تأخذه مباشرة إلى قسم التأمين في `/rewards`.

## التغييرات

### 1) `src/components/rewards/panels/PrinterActivationPanel.tsx`
- بعد `activateMutation` ناجح، تُعرض بطاقة `warrantyData` خضراء (موجودة الآن).
- نضيف بطاقة جديدة تظهر فقط حين يكون `warrantyData.activation_date` حديث (≤ 5 دقائق) أو ببساطة دائماً تحت بطاقة الضمان النشط، بشرط `active === true` ولا يوجد اشتراك حماية مسبق.
  - **بساطة وأمان**: نعرضها دائماً عند `active === true`، عنوانها: "اربطها ببطاقة تأمين" + شرح: خصومات صيانة، خصومات قطع غيار، استمرار الحماية بعد انتهاء الضمان.
  - زر "اشترك في بطاقة تأمين" → `navigate('/rewards?tab=insurance&printer={serial_number}')`.
- نضيف `useNavigate`.

### 2) `src/components/rewards/InsuranceSection.tsx` (تأكد من قراءة `?printer=`)
- استخدام `useSearchParams` (موجود في `PrinterActivationPanel` كنمط) لتوسيع الطابعة المطابقة لـ `?printer=<serial>` تلقائياً عبر `setExpandedPrinter(printerId)` عند التحميل.
- لا نغيّر منطق الاشتراك الحالي.

### 3) i18n (ar/en/ku + types.ts)
مفاتيح جديدة:
- `pa_offer_insurance_title` = "اربطها ببطاقة تأمين"
- `pa_offer_insurance_desc` = "احصل على خصومات صيانة وقطع غيار وحماية ممتدة بعد انتهاء الضمان."
- `pa_offer_insurance_cta` = "اشترك في بطاقة تأمين"
- `pa_offer_insurance_skip` = "ربما لاحقاً"

### 4) Memory
تحديث `mem://features/hardware/warranty-loyalty-benefits` لذكر: بعد تفعيل الضمان يظهر CTA لاشتراك بطاقة التأمين يحوّل لـ `/rewards?tab=insurance&printer=<serial>`.

## ملاحظات تقنية
- لا تغييرات في قاعدة البيانات.
- لا حساب جديد في السلة.
- الحماية تبقى عبر `InsuranceSection` (RLS وmutation موجودة).
