

## إصلاح نافذة إدارة تذاكر المستخدمين

### المشاكل
1. **النافذة جامدة (غير قابلة للتمرير)**: `ScrollArea` داخل `flex` مع `overflow-hidden` + ارتفاع ثابت `h-[400px]` يسبب تجمد المحتوى
2. **المستخدمون الذين لديهم تذاكر لا يظهرون**: الاستعلام يجلب جميع المستخدمين بما فيهم من رصيدهم `0` — يجب فلترة من لديه تذاكر فعلية (`ticket_count > 0`)

### الحل — `src/components/UserTicketsManager.tsx`

#### 1. إصلاح تجمد النافذة
- تغيير `DialogContent` ليكون `overflow-y-auto` بدل `overflow-hidden`
- إزالة `ScrollArea` واستبدالها بـ `div` مع `overflow-y-auto` و `max-h` مرن
- تبسيط هيكل الـ flex layout

#### 2. إظهار المستخدمين الذين لديهم تذاكر فقط
- إضافة `.gt('ticket_count', 0)` في استعلام `user_tickets` لجلب فقط من لديهم تذاكر فعلية
- تحديث الإحصائيات لتعكس العدد الصحيح

#### 3. إصلاح تعارض Dialog المتداخل
- إضافة `modal={false}` للـ Dialog الداخلي (إضافة تذاكر) لمنع تعارض focus trap مع Dialog الخارجي

### الملف المتأثر
- `src/components/UserTicketsManager.tsx` فقط

