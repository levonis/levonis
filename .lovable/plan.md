## الهدف
داخل **نافذة الفاتورة المنبثقة** (`OrderInvoiceDialog`) التي تفتح من زر "فاتورة" بصفحة `OrderDetail`، توسيع جدول الحساب ليعرض كل بنود الحساب التفصيلية، وجعل **المبلغ المتبقي على ورقة التوصيل (COD)** قابلاً للنسخ بنقرة واحدة.

## الملفات المتأثرة
- `src/components/OrderInvoiceDialog.tsx` — توسيع البيانات + توسيع قسم الإجماليات + إضافة شريط النسخ.

## التغييرات

### 1) توسيع استخراج البيانات (Top of component)
إضافة الحقول التالية من `order` (موجودة أصلاً في الـ select بـ `OrderDetail`):
- `cardDiscount` ← `card_discount_amount`
- `cardLevelName` ← `card_discount_level_name`
- `couponCode` ← `coupon_code`
- `referralCouponId` + `originalDelivery` ← لتمييز التوصيل المجاني عبر كوبون الإحالة
- `walletPaid` ← `customer_paid_amount || paid_amount`
- `walletBefore` ← `wallet_balance_before`
- `walletAfter` ← `max(0, walletBefore - walletPaid)`
- `codRemaining` ← `remaining_amount ?? max(0, total - walletPaid)`
- `paymentMethod` ← `payment_method`
- إعادة حساب `delivery` الفعلي = `total - subtotal + discount + cardDiscount` كاحتياط إذا كان `delivery_fee` فارغاً.

### 2) توسيع قسم Totals داخل `InvoiceTemplate`
يضاف بترتيب منطقي قبل `Total`:
- Sub-total (موجود)
- صف **التوصيل**: إذا كان مجانياً عبر كوبون إحالة يظهر "مجاني عبر الكوبون" مع شطب السعر الأصلي.
- صف **خصم الكوبون** مع عرض كود الكوبون: `discount (CODE)`
- صف **خصم بطاقة الولاء** مع اسم المستوى
- إجمالي التوفير (اختياري سطر صغير رمادي)
- خط فاصل ثم **Total** (موجود)
- صف **مدفوع من المحفظة** (بالأخضر) + سطر صغير "الرصيد قبل ← بعد" إن توفر
- صف **طريقة الدفع**
- **بطاقة بارزة**: "المبلغ المطلوب على ورقة التوصيل" (COD remaining) — تظهر داخل قالب الفاتورة بحيث تطبع أيضاً.

### 3) شريط النسخ (خارج قالب الطباعة)
داخل `OrderInvoiceDialog` فوق منطقة المعاينة (تحت شريط الأزرار "طباعة/تنزيل PDF") تُضاف بطاقة UI **خارج `invoiceRef`** (لا تظهر في الطباعة) تحتوي:
- أيقونة شاحنة + نص "المبلغ المتبقي عند الاستلام"
- الرقم بخط كبير + زر `Copy/Check` يستخدم `navigator.clipboard.writeText(String(codRemaining))` ويستدعي `toast.success('تم نسخ المبلغ')`.
- إذا كان `codRemaining === 0` تظهر شارة "مدفوع بالكامل ✓" بدون زر نسخ.
- الرقم نفسه أيضاً قابل للنقر لينسخ (نفس الـ handler).

### 4) i18n والتنسيق
- استخدام `.toLocaleString()` للأرقام (موجود بالفعل في الملف).
- الحفاظ على نمط الفاتورة الحالي (LTR للقسم الأيسر، أحجام خط 13-15px لصفوف الإجماليات).
- بطاقة COD داخل القالب: حدّ بلون كهرماني عند وجود متبقّ، وأخضر عند الدفع الكامل، بنفس نمط بطاقة AdminOrders للاتساق البصري.

## ملاحظات
- لا تغييرات على قاعدة البيانات ولا على `OrderDetail.tsx` (كل الحقول مجلوبة سابقاً).
- زر النسخ خارج `invoiceRef` ضروري لئلا يظهر في PDF أو نسخة الطباعة.
- لا تغييرات في صفحة `AdminOrders` (لها ملخصها المنفصل).