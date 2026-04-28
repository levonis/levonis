## المشكلة

في `/cp-x9A3kL7m/printer-protection` يقوم الإدمن بضبط `activation_date` و`expiry_date` للطابعة (مثلاً 1-4) عبر `AdminQRPrinterTab` → `setWarrantyMutation`. عند مسح المستخدم لـ QR وتفعيل الطابعة لاحقاً (مثلاً 7-4)، يقوم `PrinterActivationPanel.tsx` بكتابة تاريخ جديد فوق التاريخ الذي ضبطه الإدمن:

```
// السطر 85-86 و 124-125
const activationDate = new Date();              // ❌ يتجاهل تاريخ الإدمن
const expiryDate = addMonths(activationDate, printerData.warranty_months || 6);
```

هذا يؤدي إلى أن السيريال `31B8BP5B0801292` ضاع منه تاريخ الإدمن (1-4) واستُبدل بتاريخ التفعيل الفعلي (7-4).

## الحل

تعديل `src/components/rewards/panels/PrinterActivationPanel.tsx` ليحترم التواريخ التي ضبطها الإدمن مسبقاً:

1. **في `activateMutation` (السطر 81–140):**
   - إذا كان `printerData.activation_date` و`printerData.expiry_date` موجودان مسبقاً (ضبطهم الإدمن)، استخدمهما كما هما ولا تكتب فوقهما في `update()`.
   - فقط إذا كانا فارغَين (null)، احسبهما من `new Date()` و`warranty_months` كسلوك احتياطي للحالات القديمة.
   - في كلتا الحالتين، حدّث `buyer_user_id`, `status`, `is_registered` فقط.

2. **في `onSuccess` (السطر 120–136):**
   - استخدم نفس التواريخ المحفوظة في `printerData` بدل إنشاء `new Date()` جديد، حتى تظهر بطاقة الضمان للمستخدم بالتاريخ الصحيح فوراً بعد التفعيل.

3. **إصلاح بأثر رجعي للسيريال المتأثر `31B8BP5B0801292`:**
   - بعد التأكد من التاريخ الذي يريده الإدمن (1-4)، تشغيل تحديث يدوي لإرجاع `activation_date` و`expiry_date` إلى القيم الصحيحة عبر insert tool. سأطلب تأكيد التاريخ الفعلي قبل التشغيل، أو يمكن للإدمن إعادة ضبطه من واجهة `AdminQRPrinterTab` بعد نشر الإصلاح.

## ملفات ستتغير

- `src/components/rewards/panels/PrinterActivationPanel.tsx` — منع الكتابة فوق تواريخ الضمان المضبوطة من الإدمن.

## ملاحظات تقنية

- `printerData` مُحمَّل أصلاً من `store_printers` (السطر 50–60 من نفس الملف عبر `select('*')`)، فالحقول متاحة بدون استعلام إضافي.
- لا حاجة لتغيير قاعدة البيانات أو RLS — فقط منطق العميل.
- لا تأثير على `WarrantyDashboard.tsx` أو `MyPrintersPanel.tsx` لأنهما يقرآن التواريخ كما هي من قاعدة البيانات.
