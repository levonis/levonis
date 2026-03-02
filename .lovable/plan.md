

## خطة تحسين نافذة تأكيد طلب البيع المباشر

### المشكلة 1: التصميم غير متوافق مع ثيم الموقع
الخلفيات الفاتحة (`bg-muted/30`, `bg-accent/10`, `bg-primary/5`) لا تتماشى مع الثيم الزجاجي الاحترافي المستخدم في الموقع.

**الحل**: تطبيق تصميم Glassmorphism ثلاثي الأبعاد على كامل النافذة:
- `DialogContent`: خلفية `backdrop-blur-xl` مع `bg-background/80` وحدود متوهجة `border-primary/20` وظل ثلاثي الأبعاد
- أقسام العنوان والملخص والمحفظة: استخدام `bg-white/5 dark:bg-white/5 backdrop-blur-sm border border-white/10` بدلاً من `bg-muted/30`
- الهيدر: تدرج زجاجي مع `backdrop-blur` وخلفية شبه شفافة
- تنبيهات الشحن: خلفيات شبه شفافة مع blur بدلاً من ألوان فاتحة مسطحة
- زر التأكيد: إضافة ظل متوهج `shadow-lg shadow-primary/25`

### المشكلة 2: منطق "تجاوزت الساعة 5 مساءً" غير صحيح
حالياً يعتمد فقط على الوقت. المنطق الصحيح: يجب أن تظهر رسالة "يمكنك إضافة منتجات أخرى لنفس الشحنة" **فقط** إذا كان لدى الزبون طلبات بيع مباشر نشطة (بحالة `pending` أو `confirmed` أو `processing`) **و** لم يتجاوز الساعة 5 مساءً.

**الحل**:
- إضافة prop جديد `hasActiveDirectOrders: boolean` إلى `DirectSaleCheckoutDialog`
- في `Cart.tsx`: الاستعلام عن طلبات البيع المباشر النشطة للمستخدم بحالات (`pending`, `confirmed`, `processing`)
- إظهار رسالة "لديك وقت لإضافة منتجات" فقط إذا `hasActiveDirectOrders && isBeforeCutoff`
- إخفاء رسالة "تجاوزت الساعة 5 مساءً" إذا لم يكن لديه طلبات نشطة أصلاً (لا داعي للتنبيه)

### الملفات المتأثرة
- `src/components/DirectSaleCheckoutDialog.tsx` — تصميم زجاجي + تعديل منطق العرض
- `src/pages/Cart.tsx` — استعلام الطلبات النشطة وتمرير `hasActiveDirectOrders`

