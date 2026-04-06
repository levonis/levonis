

## إصلاح 3 مشاكل في صفحة القسم والمنتج المميز

### المشاكل المُحددة

1. **اسم المنتج مكرر**: المنتج المميز يعرض الاسم والسعر في `FloatingProductCard` (سطر 81-97) **وأيضاً** الاسم والوصف في `CategoryDetail.tsx` (سطر 99-116) — يجب إزالة الاسم والسعر من البطاقة المميزة ونقل السعر للمنصة
2. **السعر يجب أن يكون محفوراً في المنصة**: بدل عرض السعر تحت المنصة، يُعرض السعر (مع الخصم إن وجد) محفوراً في الواجهة الأمامية للمنصة بجانب نسبة الخصم
3. **اختيار المنتج المميز لا يُحفظ**: `select` يستخدم `defaultValue` وهو لا يتغير عند تغيير `editingCategory` — يجب تحويله لمكوّن مُتحكَّم (controlled)

---

### التعديلات

#### 1. `FloatingProductCard.tsx` — المنتج المميز
- **إزالة** قسم معلومات المنتج (الاسم + السعر) من أسفل المنصة (سطر 80-98)
- **تعديل** الواجهة الأمامية (`cube-front-featured`) لعرض السعر محفوراً:
  - إذا يوجد خصم: عرض السعر بعد الخصم + نسبة الخصم
  - إذا لا يوجد خصم: عرض السعر فقط
  - نفس تأثير الحفر الموجود (text-shadow)

```tsx
<div className="cube-front-featured relative overflow-hidden">
  <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
    <span className="text-base md:text-lg font-black" style={{/* engraved style */}}>
      {price.toLocaleString()} د.ع
    </span>
    {discount > 0 && (
      <span className="text-xs font-bold" style={{/* engraved style */}}>
        -{discount}%
      </span>
    )}
  </div>
</div>
```

#### 2. `CategoryDetail.tsx` — إضافة السعر بجانب الاسم
- بما أن السعر أُزيل من البطاقة، يُضاف السعر في قسم النص (يسار) بعد اسم المنتج وقبل الوصف

#### 3. `Admin.tsx` — إصلاح حفظ المنتج المميز
- تحويل `select` من `defaultValue` (uncontrolled) إلى `value` + `onChange` مع state:
  - إضافة state: `const [selectedFeaturedProduct, setSelectedFeaturedProduct] = useState('')`
  - تحديث القيمة عند فتح dialog التعديل
  - استخدام `value={selectedFeaturedProduct}` بدل `defaultValue`
  - إضافة `onChange` handler
  - قراءة القيمة من الـ state بدل `formData.get('featured_product_id')`

### الملفات المتأثرة
- `src/components/FloatingProductCard.tsx`
- `src/pages/CategoryDetail.tsx`
- `src/pages/Admin.tsx`

