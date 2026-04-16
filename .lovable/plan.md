

# ميزة التوصيل المجاني وتكلفة التوصيل الفعلية

## ملخص الطلب
1. **تفعيل توصيل مجاني** لكل طريقة توصيل (استلام/اعتيادي/شخصي) مع حد أدنى اختياري
2. **تكلفة التوصيل الفعلية** تُخصم من العائد في القسم المالي (كرقم سالب)
3. **تكلفة التوصيل الشخصي للمنتج** — حقل جديد في تعديل المنتج يُضاف للسعر النهائي ويظهر في المالية

---

## التغييرات المطلوبة

### 1. قاعدة البيانات — Migration

**جدول `delivery_methods`** — إضافة 3 أعمدة:
- `free_delivery_enabled` (boolean, default false) — تفعيل التوصيل المجاني
- `free_delivery_min_order` (integer, default 0) — الحد الأدنى لمجموع المنتجات
- `actual_cost` (integer, default 0) — التكلفة الفعلية التي تُخصم من العائد

**جدول `products`** — إضافة عمود:
- `personal_delivery_cost` (integer, default 0) — تكلفة التوصيل الشخصي الفعلية للمنتج

### 2. صفحة إعدادات الشحن — `AdminShippingSettings.tsx`

في كل بطاقة طريقة توصيل (`DeliveryMethodCard`):
- إضافة **Switch** لتفعيل التوصيل المجاني
- عند التفعيل يظهر حقل **الحد الأدنى للطلب** (0 = مجاني بدون حد)
- إضافة حقل **التكلفة الفعلية للتوصيل** (المبلغ الذي يُخصم من الأرباح)
- حفظ هذه القيم مع الحفظ الحالي

### 3. صفحة السلة — `Cart.tsx`

تعديل `getDeliveryFee`:
- بعد حساب الرسوم العادية، فحص إذا كان `free_delivery_enabled` مفعّل للطريقة المختارة
- إذا `free_delivery_min_order > 0`: مقارنة مجموع المنتجات (بدون توصيل) مع الحد الأدنى
- إذا تحقق الشرط: إرجاع 0 مع عرض شارة "توصيل مجاني 🎉"
- إذا لم يتحقق: عرض كم يحتاج المستخدم للوصول للحد الأدنى

### 4. تعديل المنتج — `AdminProductPricingSection.tsx`

إضافة حقل **تكلفة التوصيل الشخصي** (personal_delivery_cost):
- يظهر فقط عندما المنتج `has_in_stock = true`
- يُضاف هذا المبلغ لسعر البيع المباشر (`direct_sale_price += personal_delivery_cost`)
- يظهر في معاينة السعر

### 5. حفظ المنتج — `Admin.tsx`

- قراءة `personal_delivery_cost` من الفورم
- إضافته لـ `direct_sale_price` عند الحساب

### 6. القسم المالي — `AdminFinancials.tsx` / `AdminOrders.tsx`

- عرض عمود **تكلفة التوصيل** في تفاصيل الطلب المالي
- حسابه: التكلفة الفعلية من `delivery_methods.actual_cost` (للاعتيادي) أو `products.personal_delivery_cost` (للشخصي)
- عرضه **بالسالب** مخصوماً من العائد
- العائد الصافي = سعر المنتج - تكلفة المنتج - تكلفة التوصيل الفعلية

---

## الملفات المتأثرة

| الملف | النوع |
|-------|-------|
| Migration SQL | إنشاء |
| `src/pages/AdminShippingSettings.tsx` | تعديل |
| `src/pages/Cart.tsx` | تعديل |
| `src/components/admin/AdminProductPricingSection.tsx` | تعديل |
| `src/pages/Admin.tsx` | تعديل |
| `src/pages/AdminFinancials.tsx` | تعديل |
| `src/pages/AdminOrders.tsx` | تعديل |

