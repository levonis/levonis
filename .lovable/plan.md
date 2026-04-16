

# ربط التوصيل الشخصي بالطابعات فقط وتوضيح المنطق المالي

## الوضع الحالي
- حقل `personal_delivery_cost` يظهر لجميع المنتجات في تعديل/إضافة المنتج
- في المالية، يتم خصم `personal_delivery_cost` من أي طلب بغض النظر عن نوع التوصيل
- التوصيل الشخصي مربوط بقسم محدد (الطابعات) عبر `base_price_category_id` — يظهر فقط إذا السلة تحتوي طابعات ✓

## التغييرات المطلوبة

### 1. `AdminProductPricingSection.tsx`
- إظهار حقل `personal_delivery_cost` **فقط** عندما يكون المنتج ينتمي لقسم الطابعات (أو أي قسم مرتبط بالتوصيل الشخصي)
- تغيير التسمية: **"تكلفة التوصيل الشخصي (د.ع)"** — بدون "الاعتيادي"
- تغيير الوصف: "خاص بالطابعات — يُضاف للسعر النهائي ويُخصم من العائد في القسم المالي"
- نحتاج تمرير `categoryId` أو `isPrinterCategory` للمكون لتحديد الإظهار

### 2. `Admin.tsx`
- عند الحفظ: إضافة `personalDeliveryCostVal` للسعر النهائي فقط إذا كان المنتج من قسم الطابعات
- للمنتجات الأخرى: `personalDeliveryCostVal = 0` تلقائياً

### 3. `AdminFinancials.tsx` — تحسين `calcActualDeliveryCost`
- إذا التوصيل **شخصي** (`delivery_method === 'personal'`): استخدام `personal_delivery_cost` من المنتج
- إذا التوصيل **اعتيادي** (`delivery_method === 'standard'`): استخدام `actual_cost` من `delivery_methods`
- حالياً يفضّل `personal_delivery_cost` دائماً وهذا خطأ — يجب التفريق بنوع التوصيل

### التفاصيل التقنية

**تحديد قسم الطابعات:**
- نجلب `delivery_methods` التي لها `base_price_category_id` (التوصيل الشخصي)
- إذا `category_id` للمنتج المحرر يطابق أي `base_price_category_id` → إظهار الحقل

**المالية (calcActualDeliveryCost):**
```
if delivery_method === 'personal':
  cost = sum(item.products.personal_delivery_cost * quantity)
else:
  cost = delivery_methods[order.delivery_method].actual_cost
```

### الملفات المتأثرة
| الملف | النوع |
|-------|-------|
| `src/components/admin/AdminProductPricingSection.tsx` | تعديل |
| `src/pages/Admin.tsx` | تعديل |
| `src/pages/AdminFinancials.tsx` | تعديل |

