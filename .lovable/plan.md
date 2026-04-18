
المستخدم يريد إضافة خيار **إدخال يدوي** لمنتج جديد (اسم + سعر) في حوار "تعديل منتجات الطلب" داخل `AdminOrderItemEditor.tsx`، بدلاً من الاقتصار على اختيار منتج موجود من القائمة.

## الوضع الحالي

في `src/components/admin/AdminOrderItemEditor.tsx` قسم "إضافة منتج جديد" يحتوي فقط على Select لاختيار منتج موجود من جدول `products`. عند الإضافة يستدعي `addItem(productId)` الذي يجلب بيانات المنتج ويضيفه للقائمة.

عند الحفظ، المنتجات الجديدة:
- تستدعي `admin_adjust_order_inventory` (تعديل مخزون) — وهذا يتطلب `product_id` حقيقي
- تُدرج في `order_items` مع `product_id`

ملاحظة من الذاكرة (`order-items-constraint-v2`): قيد `order_items_product_or_custom_or_bundle_check` تم إسقاطه، لذا يمكن إدراج صفوف يدوية بدون `product_id`.

## التصميم المقترح

إضافة **تبويبين (Tabs)** داخل صندوق "إضافة منتج جديد":
1. **منتج موجود** (الحالي) — اختيار من القائمة
2. **إدخال يدوي** (جديد) — حقول: اسم المنتج + السعر + الكمية

### سلوك "الإدخال اليدوي"
- المنتج اليدوي يُضاف بـ `product_id: null` و `id: manual-{timestamp}`
- يحمل علامة داخلية `is_manual: true` لتمييزه
- عند الحفظ:
  - **لا** يستدعي `admin_adjust_order_inventory` (لا يوجد مخزون مرتبط)
  - يُدرج في `order_items` مع `product_id: null`، `product_name_ar` = الاسم المُدخل، `unit_price`/`quantity`/`total_price` من النموذج
- في عرض السطر: شارة صغيرة "✏️ يدوي" بدل شارة البندل لتمييزه، وحقل اللون يبقى متاحاً اختيارياً

### تغييرات الكود (ملف واحد فقط)

**`src/components/admin/AdminOrderItemEditor.tsx`**:

1. إضافة state للنموذج اليدوي:
   ```ts
   const [manualName, setManualName] = useState("");
   const [manualPrice, setManualPrice] = useState<number>(0);
   const [manualQty, setManualQty] = useState<number>(1);
   const [addMode, setAddMode] = useState<"existing"|"manual">("existing");
   ```

2. دالة `addManualItem()`:
   ```ts
   setItems(prev => [...prev, {
     id: `manual-${Date.now()}`,
     product_id: null as any,
     product_name_ar: manualName.trim(),
     product_name: manualName.trim(),
     quantity: manualQty,
     unit_price: manualPrice,
     total_price: manualQty * manualPrice,
     selected_color: null,
     selected_option: null,
     is_manual: true,
   }]);
   ```

3. تعديل منطق `handleSave` للعناصر الجديدة:
   - إذا كان `item.is_manual === true` أو `item.product_id == null` → تخطي استدعاء `admin_adjust_order_inventory`
   - إدراج الصف في `order_items` مع `product_id: null`

4. تحديث واجهة قسم "إضافة منتج جديد": أزرار toggle بين الوضعين + الحقول المناسبة لكل وضع، وزر "إضافة" واحد يستدعي الدالة المناسبة.

5. إضافة شارة "✏️ يدوي" في سطر العنصر إذا كان `is_manual` (أو `!product_id` للعناصر القديمة اليدوية).

### تحقق من الإدخال
- الاسم: `trim()` غير فارغ، حد أقصى 200 حرف
- السعر: ≥ 0
- الكمية: ≥ 1
- زر الإضافة معطّل حتى تكتمل الشروط

### ما لا يتغير
- لا تعديل على قاعدة البيانات (القيد مُسقط مسبقاً)
- لا تعديل على `admin_adjust_order_inventory`
- منطق الحذف/التعديل للعناصر الموجودة يبقى كما هو

## التأكيد
الإصلاح ضمن ملف واحد، لا migrations مطلوبة، ولا يؤثر على الطلبات الحالية أو منطق المخزون للمنتجات الفعلية.

<lov-actions>
<lov-suggestion message="جرب إضافة منتج يدوي لطلب موجود وتأكد من حفظه بدون التأثير على المخزون">تحقق أن الإضافة اليدوية تعمل</lov-suggestion>
<lov-suggestion message="أضف إمكانية تعديل اسم المنتج اليدوي بعد إضافته للسطر بدون حذفه وإعادة إضافته">تعديل اسم المنتج اليدوي لاحقاً</lov-suggestion>
<lov-suggestion message="أظهر المنتجات اليدوية في تقارير المبيعات والأرباح بقسم منفصل (بدون تكلفة شراء)">إدراج المنتجات اليدوية في التقارير المالية</lov-suggestion>
</lov-actions>
