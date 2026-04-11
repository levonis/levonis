

# خطة إصلاح شاملة — 23 مشكلة

هذه القائمة كبيرة جداً ومن الأفضل تقسيمها إلى دفعات. سأبدأ بالمشاكل الحرجة (1-8) والمشاكل المتوسطة (9-13, 23) في هذه الدفعة. المشاكل الأكبر (14-22) تحتاج دفعة منفصلة.

---

## الدفعة الأولى: إصلاحات حرجة ومتوسطة

### 1. إضافة المنتج للسلة لا تعمل
**التشخيص**: الكود يبدو صحيحاً والـ RLS سليمة. المشكلة المحتملة: الـ unique index `ux_cart_items_non_gift` لا يشمل `sale_type`، فإذا أضاف المستخدم نفس المنتج بنوع بيع مختلف يحدث conflict صامت. كما أن `shipping_option_index` قد يكون `null` مما يجعل المقارنة مع الـ index غير متطابقة.
**الحل**:
- إضافة `sale_type` إلى الـ unique index
- التعامل مع أخطاء `23505` (unique violation) بشكل صريح
- إضافة `.select()` بعد `.insert()` للتأكد من نجاح الإدراج

### 2. تتويج الفائزين لا يعمل
**التشخيص**: دالة `admin_award_crossy_road_winners` لا تتحقق من `has_role` (على عكس `admin_award_stack_winners`). لكن المشكلة الأرجح أن جدول `crossy_road_winners` أو `crossy_road_leaderboard_prizes` ليس لديه RLS policies للإدراج.
**الحل**:
- إضافة تحقق `has_role(auth.uid(), 'admin')` لجميع دوال التتويج
- التأكد من RLS policies لجداول الفائزين والجوائز
- إضافة `SECURITY DEFINER` للدوال لتجاوز RLS أثناء التتويج

### 3. تعطيل Crossy Road — صلاحيات مفقودة
**التشخيص**: جدول `crossy_road_settings` لديه فقط سياسة SELECT (قراءة عامة). **لا توجد سياسة UPDATE**.
**الحل**: إضافة سياسة UPDATE للأدمن:
```sql
CREATE POLICY "Admins can update crossy_road_settings"
ON crossy_road_settings FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
```

### 4. ترتيب الألعاب (live أولاً ثم soon)
**التشخيص**: الكود الحالي يرتب بشكل صحيح لكن يعيد 0 عند تساوي الحالة.
**الحل**: إضافة ترتيب ثانوي (مثل `display_order` أو اسم اللعبة) عند تساوي الحالة لضمان الاستقرار.

### 5. مشاكل الجذوع في Crossy Road
**التشخيص**: نفس المشاكل السابقة — snapping للجذع الأقرب بدلاً من الموقع الفعلي.
**الحل**: 
- استخدام موقع X الفعلي للاعب عند القفز على جذع
- إزالة snapping التلقائي للجذع الأقرب
- التحقق من أن الجذع الذي يهبط عليه اللاعب حقيقي (له حدود collision فعلية)
- حساب الموقع الصحيح عند مغادرة الجذع

### 6. فراغات على الشاشات الكبيرة في Crossy Road
**الحل**: إضافة عناصر ديكور (أشجار، جبال، عشب) على جوانب اللعبة خارج نطاق اللعب.

### 7. مقاس Canvas في الجوال
**الحل**: تحسين `computeZoom` لضبط الأبعاد المناسبة للجوال.

### 8. ربط Crossy Road بلوحة الأدمن
**التشخيص**: `CrossyRoadTab.tsx` موجود بالفعل ويحتوي على إعدادات أساسية.
**الحل**: التأكد من ربط النقاط والسكور ولوحة الصدارة وجوائز السكور بالإعدادات الموجودة.

### 9. تصغير Hero في /category للجوال
**الحل**: تعديل `CategoryDetail.tsx` ليجعل القسم الرئيسي أصغر على الجوال مع وضع الصورة يمين والنص يسار.

### 10. بطاقة المنتج — الصورة بدون فراغ
**الحل**: تعديل `FloatingProductCard.tsx` لجعل الصورة تملأ حدود البطاقة بالكامل (`object-cover` بدون padding) مع قسم سفلي للمعلومات.

### 11. بطاقات /category — حد أدنى 2 بطاقة بالسطر
**الحل**: تعديل الشبكة إلى `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5`.

### 12. بطاقات /bundles — نفس المبدأ
**الحل**: البطاقات حالياً `grid-cols-2 gap-2.5` وهو صحيح. إضافة `sm:grid-cols-3 lg:grid-cols-4` للشاشات الأكبر.

### 13. شريط "نفذ من المخزون" على بطاقة الباقة
**الحل**: إضافة شريط قطري من أعلى اليسار لأسفل اليمين يظهر "نفذ من المخزون" باستخدام CSS transform rotate.

### 23. التقييمات التلقائية بدون موافقة
**التشخيص**: حالياً التقييمات التلقائية (5 نجوم) تدخل بحالة pending. المطلوب أن التلقائية تدخل `approved` مباشرة، والمعدلة/المكتوبة يدوياً تبقى `pending`.
**الحل**: تعديل دالة `auto_confirm_delivery` (أو إنشاء trigger/cron) لإدراج التقييمات التلقائية بحالة `approved`. التقييمات المعدلة من المستخدم تبقى `pending`.

---

## ملفات ستتأثر

### قاعدة البيانات (Migrations):
- إضافة UPDATE policy لـ `crossy_road_settings`
- تحديث unique index لـ `cart_items` لتشمل `sale_type`
- إضافة `SECURITY DEFINER` لدوال التتويج
- تعديل منطق التقييمات التلقائية

### الملفات:
- `src/hooks/useCart.tsx` — معالجة أخطاء unique violation
- `src/pages/MiniGames.tsx` — ترتيب الألعاب
- `src/pages/CategoryDetail.tsx` — Hero للجوال + شبكة بطاقات
- `src/components/FloatingProductCard.tsx` — تصميم البطاقة
- `src/pages/ProductBundles.tsx` — شبكة + شريط نفاد المخزون
- `src/components/games/crossy-road/CrossyRoad3DScene.tsx` — إصلاح الجذوع والديكور
- `src/components/games/crossy-road/CrossyRoadCanvas.tsx` — zoom الجوال والشاشات الكبيرة

---

## ملاحظة عن البنود 14-22
هذه بنود كبيرة (أداء، skeleton loading، تحميل الألعاب، شريط الفائزين، تحسين البروفايل، إعدادات، تعديل الطلبات، المخزون اللحظي) وتحتاج دفعة منفصلة بعد إتمام هذه الإصلاحات.

