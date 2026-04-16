

# إصلاح نظام حساب المخزون — تحليل وخطة

## المشاكل المكتشفة

### 1. `admin_adjust_order_inventory` — معطّلة بالكامل
هذه الدالة تتعامل مع `option_stocks` على أنها مصفوفة كائنات `[{option_id, stock}]`، بينما الشكل الحقيقي في قاعدة البيانات هو كائن مسطّح `{"اسم الخيار": العدد}`. لذلك لا تعدّل المخزون أبداً عند تعديل عناصر الطلب من لوحة الإدارة.

### 2. `deduct_order_stock` — لا تخصم من `direct_stock`
عند إتمام طلب، يتم خصم المخزون من `colors->option_stocks` فقط، لكن **لا يتم تحديث** `direct_stock` في جدول المنتجات. هذا يجعل المخزون المعروض في الموقع أعلى من الحقيقي.

### 3. `cancel_order` — لا تُرجع `direct_stock`
نفس المشكلة بالعكس: عند الإلغاء يتم إرجاع المخزون إلى `option_stocks` لكن `direct_stock` لا يتم تحديثه.

### 4. عدم تطابق أسماء الألوان
إذا لم يتطابق اسم اللون المحفوظ في الطلب مع اسم اللون في المنتج (عربي/إنجليزي)، لا يتم خصم/إرجاع المخزون ولا يتم تعليم الطلب كـ `stock_deducted`.

---

## خطة الإصلاح

### الخطوة 1: إعادة كتابة `deduct_order_stock`
- إضافة تحديث `direct_stock` بعد خصم `option_stocks` لكل عنصر
- حساب إجمالي الكمية المخصومة وتحديث `direct_stock = direct_stock - total_qty`
- مطابقة اللون بـ `name` و `name_ar` عبر `normalize_text_key`

### الخطوة 2: إعادة كتابة `cancel_order` (قسم إرجاع المخزون)
- إضافة تحديث `direct_stock` بعد إرجاع `option_stocks` لكل عنصر
- `direct_stock = direct_stock + total_restored_qty`

### الخطوة 3: إعادة كتابة `admin_adjust_order_inventory`
- تغيير المنطق من مصفوفة كائنات إلى كائن مسطّح `{"option_name": count}`
- استخدام `jsonb_each_text` + `normalize_text_key` لمطابقة اسم الخيار
- تحديث `direct_stock` بشكل صحيح
- إزالة تحديث `stock_quantity` (العمود غير موجود)

### الخطوة 4: تحديث `AdminOrderItemEditor.tsx`
- تمرير `selected_option` (اسم الخيار) بدلاً من `selected_option` كـ `p_option_id` لأن الدالة الجديدة ستعمل بالأسماء

---

## التفاصيل التقنية

### Migration SQL — 3 دوال محدّثة

**`deduct_order_stock`**: يضيف بعد حلقة العناصر:
```sql
-- After processing each item's colors, also update direct_stock
UPDATE products 
SET direct_stock = GREATEST(0, COALESCE(direct_stock, 0) - v_item.quantity)
WHERE id = v_item.product_id;
```

**`cancel_order`**: يضيف بعد إرجاع ألوان كل عنصر:
```sql
UPDATE products 
SET direct_stock = COALESCE(direct_stock, 0) + v_item.quantity
WHERE id = v_item.product_id;
```

**`admin_adjust_order_inventory`**: إعادة كتابة كاملة لاستخدام:
```sql
-- Match option by name using flat object format
jsonb_each_text(color_obj->'option_stocks') AS os
WHERE normalize_text_key(os.key) = normalize_text_key(p_option_name)
```
مع تغيير الباراميتر من `p_option_id UUID` إلى `p_option_name TEXT`.

### تعديل `AdminOrderItemEditor.tsx`
- تمرير `item.selected_option` كـ `p_option_name` بدلاً من `p_option_id`
- إزالة `as any` cast

### الملفات المتأثرة
| الملف | النوع |
|-------|-------|
| Migration SQL جديد | إنشاء |
| `src/components/admin/AdminOrderItemEditor.tsx` | تعديل |

