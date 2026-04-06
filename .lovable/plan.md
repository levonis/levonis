

# إضافة اختيار منتج مميز للقسم الفرعي من لوحة الإدارة

## الملخص
إضافة عمود `featured_product_id` لجدول `categories` يسمح للأدمن باختيار منتج مميز واحد لكل قسم فرعي، يظهر على المنصة ثلاثية الأبعاد في صفحة القسم.

## التغييرات

### 1. Migration — إضافة عمود `featured_product_id`
```sql
ALTER TABLE public.categories 
ADD COLUMN featured_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL;
```

### 2. `src/pages/Admin.tsx` — إضافة حقل اختيار المنتج المميز في نموذج القسم
- إضافة `<select>` في فورم القسم الفرعي يعرض منتجات القسم الحالي
- تحديث `categorySchema` و `handleCategorySubmit` ليشمل `featured_product_id`
- تحديث mutations (`createCategory` / `updateCategory`) لإرسال الحقل الجديد

### 3. `src/pages/CategoryDetail.tsx` — استخدام المنتج المحدد
- جلب `featured_product_id` من بيانات القسم
- إذا كان محدداً: عرض المنتج المختار على المنصة، والباقي في الشبكة
- إذا لم يكن محدداً: الاحتفاظ بالسلوك الحالي (أول منتج بالسعر)

### الملفات المتأثرة
1. **Migration SQL** — عمود جديد
2. `src/pages/Admin.tsx` — حقل اختيار في فورم القسم
3. `src/pages/CategoryDetail.tsx` — منطق عرض المنتج المميز

