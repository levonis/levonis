# مزايا الولاء المرتبطة بضمان الطابعة

## الفكرة باختصار

أي مستخدم يشتري طابعة من الموقع ويفعّل الضمان (سجّل الـ Serial Number) يحصل تلقائياً — بدون شراء بطاقة ولاء — على باقة مزايا شهرية متجددة من تاريخ تفعيل الضمان، طوال فترة الضمان (مثلاً 12 شهراً).

المزايا قابلة للضبط من لوحة الأدمن لكل **منتج طابعة** على حدة (لأن طابعة بـ 500$ ليست مثل طابعة بـ 5000$):

- نسبة خصم على المشتريات (مثال 10%) بسقف شهري (مثال 25,000 د.ع).
- عدد مرات توصيل مجاني شهرياً (مثال 5) بحد أدنى للطلب (مثال 50,000 د.ع).
- يتجدد الرصيد تلقائياً كل شهر اعتباراً من *يوم* تفعيل الضمان (لو فُعِّل يوم 28، يتجدد كل 28).

تُطبَّق المزايا في السلة بنفس واجهة بطاقات الولاء الحالية (شارة، خصم ظاهر، عداد متبقّي).

## ما يتغيّر للمستخدم

- صفحة **الضمان (`/warranty-dashboard`)** و **طابعاتي (`/my-printers`)**: تظهر بطاقة "مزاياك من الضمان" تعرض:
  - نسبة الخصم وسقفها الشهري + المتبقي والتاريخ المتجدد.
  - عدد مرات التوصيل المجاني المتبقية والحد الأدنى للطلب.
  - تاريخ التجديد القادم (مثال: "يتجدد في 28 من كل شهر").
- في **السلة**: 
  - يُحسب الخصم تلقائياً ويظهر سطر "خصم الضمان — 10%" مع المتبقي.
  - عند اختيار التوصيل، إذا الطلب ≥ الحد الأدنى ومتبقي مرات، يصبح التوصيل مجانياً مع شارة.
- في **صفحة المنتج / الكتلوج**: شارة صغيرة "الطابعة تمنحك خصم 10%" للمستخدم الذي لديه طابعة مسجلة.
- التوافق مع بطاقات الولاء: يُطبَّق *الأفضل للمستخدم* بين الاثنين على نفس الطلب (لا يُجمعان لتجنّب التكدّس).

## ما يتغيّر للأدمن

في صفحة إدارة المنتجات (لمنتجات الفئة "Printer" فقط) يظهر قسم جديد **"مزايا ضمان هذا الطابعة"**:

- مدة الضمان (شهر) — موجودة أصلاً.
- نسبة الخصم الشهري (%) + السقف الشهري (د.ع).
- عدد مرات التوصيل المجاني الشهرية + الحد الأدنى للطلب.
- طرق التوصيل المؤهلة (Standard / Personal …) — checkbox.
- زر تشغيل/إيقاف ميزة الولاء كاملة للطابعة.

كذلك في **قائمة الضمانات النشطة** يظهر لكل ضمان: المتبقي من الخصم هذا الشهر، عدد مرات التوصيل المستخدمة، تاريخ التجديد القادم — مع زر إعادة تعيين يدوي.

## آلية التجديد الشهري

اعتماداً على **تاريخ تفعيل الضمان `activation_date**` الموجود حالياً في `store_printers`:

- يُحسب "بداية الشهر الحالي للضمان" ديناميكياً عند كل قراءة (مثال: نشط منذ 28/01 → الفترة الحالية 28 من شهر/سنة الحالي إلى 27 من الشهر التالي).
- لا حاجة لـ Cron Job — الحساب On-the-fly عبر دالة Postgres ترجع `period_start` / `period_end` للضمان.
- الاستخدام يُسجَّل في جدول جديد بربطه بـ `user_printer_id` و`order_id`، والاستعلام يحسب فقط ما تم استخدامه ضمن الفترة الحالية.

---

## التفاصيل التقنية

### قاعدة البيانات

**جدول جديد `printer_warranty_benefits**` (إعدادات قابلة للضبط لكل منتج طابعة):

```
product_id (FK products), discount_percentage, discount_max_amount_monthly,
free_shipping_max_uses_monthly, free_shipping_min_order, free_shipping_methods (jsonb),
is_active
```

علاقة 1-1 مع المنتج.

**جدول جديد `printer_warranty_usage**` (سجل الاستخدام):

```
user_printer_id (FK), order_id (FK), benefit_type ('discount' | 'free_shipping'),
saved_amount, delivery_method_key, used_at
```

**دوال Postgres جديدة (SECURITY DEFINER, search_path=public):**

- `get_warranty_period_bounds(p_user_printer_id uuid)` → `(period_start timestamptz, period_end timestamptz)` تحسب الفترة الشهرية الحالية بناءً على يوم `activation_date`.
- `get_warranty_discount_used(p_user_printer_id uuid)` → numeric (مجموع الخصم المستخدم في الفترة الحالية).
- `get_warranty_free_shipping_used(p_user_printer_id uuid)` → integer (عدد المرات).
- `get_active_warranty_benefits(p_user_id uuid)` → SETOF (يُرجع كل الضمانات النشطة للمستخدم مع إعدادات المزايا والمتبقي).

**RLS:** المستخدم يقرأ فقط استخدامه الخاص؛ الإدراج يتم حصراً عبر دوال SECURITY DEFINER من السيرفر/edge function عند تأكيد الطلب.

### الواجهة الأمامية

**Hook جديد `useCartWarrantyBenefits(items, getItemPrice, cartSubtotal)`:**

- يقرأ ضمانات المستخدم النشطة (`store_printers.expiry_date > now()` و`is_registered = true`).
- يحسب أكبر خصم متاح من بين كل الضمانات (لا يُجمع بين عدة طابعات على نفس الطلب).
- يرجع نفس شكل `CartCardDiscount` تقريباً ليسهل دمجه.

**في `Cart.tsx`:**

- اختيار الأفضل بين `cardDiscount` و`warrantyBenefits`:
  - مقارنة `totalDiscount` للاثنين، وعرض الأكبر فقط.
  - نفس الشيء للتوصيل المجاني.
- عند تأكيد الطلب: استدعاء RPC `consume_warranty_benefit(user_printer_id, order_id, type, amount)` لتسجيل الاستخدام.

**صفحات الإدارة:**

- `AdminPrinterProtection.tsx` (موجودة) أو إضافة تبويب جديد `WarrantyBenefits` يعرض شبكة منتجات الطابعات مع نموذج تحرير الإعدادات.

**صفحة المستخدم (`MyPrinters.tsx` / `WarrantyDashboard.tsx`):**

- بطاقة جديدة `WarrantyBenefitsCard` تعرض المزايا والمتبقي وتاريخ التجديد، مع `useQuery` على RPC `get_active_warranty_benefits`.

### تكامل i18n

إضافة المفاتيح الجديدة (ar/en/ku):

- `warranty_benefit_discount_label`, `warranty_benefit_free_shipping_label`, `warranty_benefit_remaining`, `warranty_benefit_renews_on`, `warranty_benefit_min_order`, إلخ.

### اختيار "الأفضل" بين بطاقة الولاء وضمان الطابعة

عند وجود الاثنين معاً:

- نحسب القيمتين بشكل منفصل ونعرض الأكبر فقط في السلة (مع شارة توضح المصدر).
- منع الازدواج بنفس RPC `consume_warranty_benefit` التي ترفض إذا تم تطبيق خصم ولاء على نفس الطلب، والعكس.

## الأمان

- لا يكتب العميل مباشرة في `printer_warranty_usage` — فقط عبر RPC مع تحقق `auth.uid() = (select buyer_user_id from store_printers where id = (select store_printer_id from user_printers where id = p_user_printer_id))`.
- التحقق من نشاط الضمان (`expiry_date > now()`) داخل كل دالة.
- منع تجاوز السقف الشهري داخل RPC (LOCK → SELECT used → CHECK → INSERT).

## ما خارج النطاق

- لا تغيير على نظام بطاقات الولاء الحالي.
- لا cron jobs (التجديد محسوب ديناميكياً).
- لا إشعارات تجديد (يمكن إضافتها لاحقاً عبر edge function منفصل).