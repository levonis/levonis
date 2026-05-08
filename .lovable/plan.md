## الهدف
عند استخراج رابط منتج في صفحة الأدمن، يتم تعبئة الحقول التالية تلقائياً:
1. **البراند / الشركة المصنعة**
2. **ترتيب العرض** (الرقم التالي المتاح في نفس الفئة)
3. **أبعاد الكرتون مع التغليف** (وليس أبعاد المنتج العاري)
4. **الوزن الإجمالي مع التغليف** (Gross weight)

## المشكلة الحالية
- حقول `#brand` و`#display_order` لا يتم ملؤها مطلقاً من نتائج الاستخراج.
- حقول `#length_cm`, `#width_cm`, `#height_cm`, `#weight_kg` يتم وسمها كـ "ممتلئة" بصرياً فقط، لكن **لا تكتب القيم في الـinputs ولا في حالة `AdminProductPricingSection`**.
- موجّهات (prompts) الذكاء الاصطناعي تطلب "package dimensions" بشكل ضعيف وأحياناً يعيد أبعاد المنتج العاري بدلاً من أبعاد الكرتون.

## التغييرات

### 1) Edge Function — `supabase/functions/extract-product-info/index.ts`
- **إضافة استخراج البراند**:
  - من JSON-LD (`brand.name` أو `brand` كنص)، ومن `og:brand`، ومن `meta[name="brand"]`، ومن hostname (مثلاً `qidi3d.com` → `QIDI`).
  - تمرير `brand` في موجّه AI كـfield إضافي للاستخلاص من العنوان/الوصف عند الفشل.
  - إعادته في `productInfo.brand`.
- **تشديد موجّهات الأبعاد/الوزن**: تعديل الـprompts الحالية والـweb-search prompt لتطلب صراحةً:
  - **Packaging / carton box dimensions including all packaging materials** (ليس أبعاد المنتج).
  - **Gross weight including packaging** (وليس Net weight).
  - عند توفر كلا الرقمين في الصفحة (Net + Gross / Product + Package) يُختار دائماً الأكبر / الـPackage.
  - أمثلة محدّثة لطابعات 3D: مثل QIDI Plus4 الكرتون ~70×60×60سم ووزن إجمالي ~30كغ.
- **استخراج مباشر من HTML**: regex يبحث عن أنماط مثل `Package Dimensions / Packing Size / 包装尺寸 / Gross Weight / 毛重` ويفضّلها على Product Dimensions / Net Weight قبل اللجوء إلى AI.

### 2) `src/pages/Admin.tsx` — `applyProductInfo`
- ملء `#brand` من `productInfo.brand` عند توفره.
- حساب `display_order` التالي: قراءة أكبر `display_order` للمنتجات ضمن `category_id` المختار حالياً (من قائمة المنتجات المحمّلة بالفعل) + 1، ثم ملء `#display_order` (فقط إذا كان فارغاً أو 0 — لتجنّب الكتابة فوق قيمة عدّلها الأدمن يدوياً).
- ملء حقول الأبعاد والوزن فعلياً في الـinputs (`#length_cm` `#width_cm` `#height_cm` `#weight_kg`) مع dispatch لأحداث `input`/`change`.
- توسيع الحدث `admin-product-pricing-autofill` ليحمل `dimensions` و`weight_kg` بحيث تتحدّث حالة `AdminProductPricingSection` المحلية أيضاً.

### 3) `src/components/admin/AdminProductPricingSection.tsx`
- توسيع مستمع `admin-product-pricing-autofill` ليقبل: `length_cm`, `width_cm`, `height_cm`, `weight_kg` ويستدعي `setLengthCm/setWidthCm/setHeightCm/setWeightKg` المحلية، حتى تظهر القيم في حقول قسم التسعير وتُستخدم في حساب الشحن.

## ملاحظات
- لا تغييرات قاعدة بيانات.
- لا تغيير على منطق الأسعار أو العملة.
- البراند وترتيب العرض يُكتبان فقط إذا كانت الحقول فارغة، حتى لا تُمسح تعديلات الأدمن في حالة إعادة الاستخراج.
