## توسيع تأثير LQIP Blur ليشمل صفحات الموقع

تعميم تأثير LQIP الموجود حالياً في `ImageWithLoader` و `StoreBackgroundLayer` على باقي الصور المهمة في الموقع.

### النطاق

**1. مكتبة STL (`src/pages/StlFileDetails.tsx` و `src/components/stl/StlFileCard.tsx`)**
- استبدال `<img>` الخام لصورة الغلاف بـ `ImageWithLoader` (LQIP يعمل تلقائياً)
- معرض الصور (gallery_images): تطبيق LQIP على كل صورة في الـ grid

**2. بطاقات المنتجات (صفحات المتجر)**
- `src/components/ProductCard.tsx` — صورة المنتج الرئيسية في البطاقة
- `src/components/ProductShopCard.tsx` — نفس الشيء لشاشة المتجر

**3. بطاقة ملف STL (`StlFileCard.tsx`)**
- التحقق من نوع الصورة المستخدم وتحديثه لاستخدام `ImageWithLoader`

### التنفيذ

كل التعديلات تستخدم `ImageWithLoader` الموجود مسبقاً والذي يطبق LQIP تلقائياً (صورة 24px مضببة → تتلاشى للصورة الأصلية بانتقال 500ms). لا حاجة لمكون جديد.

في الأماكن التي تستخدم `<img>` خام بدلاً من `ImageWithLoader`:
- استبدالها مع الحفاظ على نفس الـ className والـ aspect ratio
- تمرير `width` المناسب لتفعيل srcSet
- استخدام `priority` فقط للصورة الأولى أو above-the-fold

### تفاصيل تقنية
- الصور غير-Supabase ستحصل تلقائياً على fallback skeleton (LQIP يعمل فقط مع Supabase storage URLs)
- الـ aspect-ratio محفوظ عبر container className
- لا تغييرات على الـ logic أو DB أو RLS
- لا إضافة CSS جديد — `.lqip-blur` موجود من الجولة السابقة

### الملفات المعدّلة
- `src/pages/StlFileDetails.tsx`
- `src/components/stl/StlFileCard.tsx`
- `src/components/ProductCard.tsx`
- `src/components/ProductShopCard.tsx`
