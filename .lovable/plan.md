

# إضافة حقل "تكلفة التوصيل الشخصي/الاعتيادي" لجميع أنواع البيع

## المشكلة الحالية
- حقل `personal_delivery_cost` يظهر فقط في قسم "البيع المباشر"
- يُضاف فقط لسعر البيع المباشر (`direct_sale_price`)
- لا يُضاف لأسعار الحجز المسبق (بحري/جوي)

## الإصلاح

### 1. `AdminProductPricingSection.tsx`
- **نقل** حقل "تكلفة التوصيل" من داخل قسم البيع المباشر إلى **خارج** أقسام البيع — يظهر دائماً بغض النظر عن نوع البيع
- تغيير التسمية إلى **"تكلفة التوصيل الشخصي أو الاعتيادي (د.ع)"**
- تعديل حساب المعاينة: إضافة `personalDeliveryCost` لأسعار الحجز المسبق (بحري + جوي) أيضاً

### 2. `Admin.tsx`
- إضافة `personalDeliveryCostVal` لحساب `seaFinalPrice` و `airFinalPrice` (حالياً مضاف فقط لـ `directFinalPrice`)

### التفاصيل التقنية

**المعاينة (calculations):**
```
// بحري: priceIqd + shippingCost + commission + personalDeliveryCost
// جوي: priceIqd + shippingCost + commission + personalDeliveryCost  
// مباشر: priceIqd + otherCosts + commission + personalDeliveryCost (بدون تغيير)
```

**Admin.tsx حفظ:**
```
seaFinalPrice = priceIqd + seaShipping + commissionSea + personalDeliveryCostVal
airFinalPrice = priceIqd + airShipping + commissionAir + personalDeliveryCostVal
directFinalPrice = priceIqd + otherCosts + commissionDirect + personalDeliveryCostVal (كما هو)
```

### الملفات المتأثرة
| الملف | النوع |
|-------|-------|
| `src/components/admin/AdminProductPricingSection.tsx` | تعديل |
| `src/pages/Admin.tsx` | تعديل |

