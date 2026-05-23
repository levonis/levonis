# تطوير إضافة/تعديل المنتجات في نافذة تعديل الطلب

الهدف: عند إضافة منتج جديد لطلب من نافذة "تعديل المنتجات" (`AdminOrderItemEditor`) يجب أن تُقيَّد القائمة تلقائياً حسب نوع الطلب (مباشر/حجز مسبق)، مع بحث سريع، وضبط دقيق للمخزون وعداد المبيعات عند الإضافة/التعديل/الحذف.

## 1) تحديد نوع الطلب

- جلب `order_type` ('direct' أو 'preorder') من جدول `orders` عند فتح النافذة (ضمن استعلام التمويل الحالي).
- تمريره كـ state للاستفادة منه في الفلترة والمخزون.

## 2) قائمة المنتجات المؤهلة + البحث

استبدال `Select` الحالي بمكوّن بحث (شبيه بـ `ProductSearchSelect` الموجود) داخل النافذة:

- استعلام `products_admin` يجلب: `id, name_ar, name, price, image_url, direct_stock, pre_order_stock, has_in_stock, has_pre_order, availability_type, colors, sold_count`.
- الفلترة في الواجهة حسب نوع الطلب:
  - **direct**: عرض المنتجات التي `has_in_stock = true` و(مجموع `direct_stock` أو مخزون الألوان > 0) — يتم الاعتماد على `isAllDirectStockDepleted` من `src/lib/stockUtils.ts` لاستبعاد المنفد.
  - **preorder**: عرض المنتجات التي `has_pre_order = true`.
- حقل بحث نصي (debounced) يطابق `name_ar` / `name`.
- إظهار صورة المنتج + الاسم + السعر + شارة المخزون المتاح (للمباشر) أو شارة "حجز مسبق".
- منع اختيار منتج منفد للبيع المباشر.

## 3) ربط المخزون و sold_count

### أ. إضافة منتج جديد للطلب
- **direct**: استدعاء `admin_adjust_order_inventory` بـ `p_quantity_change = -qty` (الحالي)، **بالإضافة إلى** زيادة `sold_count` بـ `+qty` عبر RPC جديدة.
- **preorder**: عدم لمس `direct_stock`، بل خصم من `pre_order_stock` (عبر RPC جديدة) وزيادة `sold_count`.

### ب. حذف منتج من الطلب
- **direct**: إرجاع المخزون `+qty` (موجود)، **و** إنقاص `sold_count` بـ `-qty`.
- **preorder**: إرجاع `pre_order_stock` و إنقاص `sold_count`.

### ج. تعديل كمية أو لون منتج موجود
- حساب فرق دقيق (`qtyDiff`) لكل من المخزون و`sold_count`.
- عند تغيير اللون: إرجاع كامل الكمية للون القديم وخصمها من اللون الجديد (الحالي يعمل، يضاف ضبط sold_count).

### د. التحقق قبل الحفظ
- منع زيادة كمية تتجاوز المخزون المتاح في البيع المباشر (مع رسالة toast واضحة قبل الحفظ).

## 4) RPC جديدة (Migration)

دالة موحّدة `admin_adjust_product_counters(p_product_id, p_order_type, p_option_name, p_selected_color, p_quantity_change)`:
- تستدعي منطق `admin_adjust_order_inventory` للمباشر (أو تكرّر منطقه إذا اخترنا الفصل).
- تعدّل `pre_order_stock` للحجز المسبق.
- تعدّل `sold_count` دائماً (إنقاص = إضافة بقيمة سالبة، زيادة = حذف بقيمة موجبة، علماً أن `p_quantity_change` يتبع تقليد الدالة الحالية: سالب=بيع، موجب=إرجاع).
- حماية بـ `has_role(auth.uid(), 'admin')`.

## 5) تعديلات الواجهة في `AdminOrderItemEditor.tsx`

- استبدال `Select` المنتجات بمكوّن بحث مخصص (Popover + Input + قائمة نتائج مع صورة/سعر/مخزون).
- إضافة شارة في رأس النافذة تعرض "نوع الطلب: بيع مباشر / حجز مسبق".
- في صف المنتج: إظهار المخزون المتاح بجانب حقل الكمية (للمباشر فقط).
- استبدال جميع نداءات `admin_adjust_order_inventory` بنداء `admin_adjust_product_counters` مع تمرير `order_type`.

## ملاحظات تقنية

- لن يتم المساس بمنطق التمويل (الشحن/COD/الضريبة/الخصم) الحالي.
- العناصر اليدوية (`is_manual`) تبقى دون أي تأثير على المخزون أو `sold_count`.
- لن يُمَس BUNDLES في هذه الجولة (يبقى السلوك الحالي).
- الفلترة تتم في الواجهة (الكمية المتوقعة للمنتجات معقولة)، مع إمكانية إضافة فلتر على مستوى الاستعلام لاحقاً إذا كبر الحجم.

## الملفات المتأثرة

- `src/components/admin/AdminOrderItemEditor.tsx` (إعادة كتابة قسم الإضافة + ربط النوع + استدعاءات RPC).
- Migration واحدة لإنشاء `admin_adjust_product_counters`.
