

## خطة: فصل مسابقات التجار عن المسابقات الرئيسية + إدارة المساعدات في لوحة مجتمع ليفو

### المشكلة الحالية
- تبويب المسابقات في صفحة "المساعدات" يعرض مسابقات الموقع الرئيسي (جدول `competitions`) بدلاً من مسابقات خاصة بالتجار
- لا توجد واجهة إدارية للمساعدات (مسابقات التجار، الهدايا، الكوبونات، الظروف) في لوحة مجتمع ليفو
- التبويب الحالي "الهدايا والكوبونات" في المجتمع (`AdminGiveawaysCoupons`) يدير `merchant_giveaways` و `customer_special_coupons` فقط

### الحل

#### 1. استبدال تبويب "الهدايا والكوبونات" بتبويب "المساعدات"
في `AdminLevoCommunity.tsx`:
- تغيير تبويب `giveaways` إلى `assistance` بعنوان "المساعدات"
- إنشاء مكون `AdminAssistanceManager.tsx` يحتوي 4 تبويبات فرعية:
  - **مسابقات التجار**: إدارة CRUD لجدول `merchant_giveaways` (مع تحسين العرض ليشمل عرض الفائزين)
  - **الهدايا**: إدارة CRUD لجدول `assistance_gifts` (إضافة/تعديل/حذف هدايا + عرض من حصّل)
  - **الكوبونات**: إدارة CRUD لجدول `assistance_coupons` (إعداد نوع الخصم والعدد المحدود + عرض التحصيلات)
  - **الظروف الحمراء**: إدارة CRUD لجدول `assistance_red_envelopes` (تحديد مبلغ الإنفاق والخصم والحد الأعلى)

#### 2. تعديل صفحة المساعدات للمستخدم
في `AssistanceCompetitions.tsx`:
- تغيير المصدر من جدول `competitions` إلى `merchant_giveaways` لعرض مسابقات التجار فقط

#### 3. الملفات المتأثرة

| ملف | تعديل |
|-----|--------|
| `src/components/admin/AdminAssistanceManager.tsx` | **جديد** - مكون إدارة المساعدات الأربعة |
| `src/pages/AdminLevoCommunity.tsx` | تغيير تبويب "الهدايا والكوبونات" → "المساعدات" + تحميل المكون الجديد |
| `src/components/assistance/AssistanceCompetitions.tsx` | تغيير مصدر البيانات من `competitions` إلى `merchant_giveaways` |

لا حاجة لتعديلات في قاعدة البيانات - الجداول الستة موجودة بالفعل (`assistance_coupons`, `assistance_gifts`, `assistance_red_envelopes` + claims).

