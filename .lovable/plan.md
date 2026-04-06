

## إصلاح زر "مميز (يظهر في الرئيسية)" لتعيين المنتج على المنصة

### المشكلة الحالية
- في قاعدة البيانات، قسم Printers يحتوي على **منتجين** مميزين (`featured: true`) وقيمة `featured_product_id` هي **null** — يعني الكود الذي يربط الزر بالمنصة لم يعمل بشكل صحيح
- الـ checkbox يستخدم `defaultChecked` (غير متحكم) مما يسبب مشاكل في قراءة القيمة الصحيحة

### التعديلات المطلوبة

#### 1. `Admin.tsx` — تحويل checkbox "مميز" إلى controlled component
- استبدال `defaultChecked` بـ `checked` مع state
- إضافة `productFeatured` state يتحدث عند فتح المنتج للتعديل
- قراءة القيمة من الـ state بدل `formData.get('featured')`

#### 2. `Admin.tsx` — إصلاح منطق الحفظ في `handleProductSubmit`
- عند تفعيل "مميز": تحديث `categories.featured_product_id` + إلغاء `featured` من كل منتجات القسم الأخرى
- عند إلغاء "مميز": مسح `featured_product_id` من القسم إذا كان هذا هو المنتج المميز حالياً
- إضافة `.select()` للتحقق من نجاح التحديث مع `console.log` للتتبع

#### 3. مزامنة البيانات الحالية
- تشغيل migration لمزامنة `featured_product_id` في جدول categories مع المنتجات المميزة الحالية وتنظيف التكرارات

### الملفات المتأثرة
- `src/pages/Admin.tsx`
- Migration SQL لمزامنة البيانات

