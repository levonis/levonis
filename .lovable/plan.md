

## خطة إصلاح مشاكل الفاتورة وإضافة رفع صورة الباركود

### المشاكل المكتشفة

1. **الفاتورة مقصوصة عند التنزيل PDF**: القالب عرضه `210mm` داخل Dialog محدود العرض، و`react-to-pdf` يُولّد بـ `margin: 0` مما يقص المحتوى
2. **الباركود مائل لليسار**: QR Code موضوع بـ `justifyContent: 'flex-end'` بدون توسيط صحيح
3. **الفاتورة لا تُحفظ**: الكود يشترط `selectedOrderId` (سطر 548) — المشترون من `registeredPrinters` ليس لديهم `orderId` فيظهر خطأ "لا يمكن حفظ الفاتورة بدون طلب مرتبط"
4. **لا توجد ميزة رفع صورة باركود**: المستخدم يريد رفع صورة QR بدلاً من الكاميرا فقط

---

### التعديلات

#### 1. إصلاح PDF المقصوص — `PrinterInvoiceGenerator.tsx`
- تصغير حجم القالب عند العرض في Dialog باستخدام `transform: scale()` مع الحفاظ على الحجم الأصلي عند التوليد
- تحسين إعدادات `react-to-pdf`: إضافة `margin` مناسب وضبط `resolution`

#### 2. توسيط الباركود — `PrinterInvoiceGenerator.tsx` (InvoiceTemplate)
- تغيير `justifyContent: 'flex-end'` إلى `justifyContent: 'center'` في حاوية QR Code
- إضافة `textAlign: 'center'` للنصوص المحيطة بالباركود

#### 3. إصلاح حفظ الفاتورة — `PrinterInvoiceGenerator.tsx`
- إزالة شرط `if (!selectedOrderId)` الذي يمنع الحفظ
- جعل `order_id` اختيارياً: إذا لم يوجد طلب مرتبط، حفظ الفاتورة بدون `order_id`
- إضافة migration لجعل عمود `order_id` في `saved_invoices` nullable

#### 4. إضافة رفع صورة الباركود — `PrinterActivationPanel.tsx`
- إضافة زر "رفع صورة" بجانب زر فتح الكاميرا
- استخدام `<input type="file" accept="image/*">` لاختيار صورة
- استخدام مكتبة `html5-qrcode` (الموجودة بالفعل) لفك تشفير QR من الصورة المرفوعة
- عند نجاح القراءة، ملء حقل الرقم التسلسلي تلقائياً والبحث

### الملفات المتأثرة
- `src/components/admin/PrinterInvoiceGenerator.tsx`
- `src/components/rewards/panels/PrinterActivationPanel.tsx`
- Migration جديد لجعل `order_id` nullable في `saved_invoices`

