

# خطة إصلاح شاملة — 12 مشكلة

## التحليل والحلول

### 1. إضافة المنتج للسلة لا تعمل
**السبب الجذري**: الـ unique index `ux_cart_items_non_gift` يشمل أعمدة nullable (`product_option_id`, `selected_color`, `shipping_option_index`). في PostgreSQL، القيم `NULL` لا تتساوى في unique index — فكل إدراج بقيم `NULL` يُعتبر فريداً ولا يطابق السجل الموجود. لكن الكود في السطر 400-408 يبحث عن `existingItem` مع مقارنة `null === null` (تُرجع `true` في JS)، فإذا كان `shipping_option_index` في قاعدة البيانات `NULL` لكن في الكود يتحول لـ `-1`، لن يتطابقا.

**الحل**:
- تعديل `addToCart` لعدم إرسال `shipping_option_index: -1` كقيمة افتراضية — إرسال `null` بدلاً منها ليتطابق مع السجلات الموجودة
- إضافة `COALESCE` في مقارنة `existingItem` للتعامل مع `null` بشكل صحيح
- تحسين معالجة خطأ `23505` لتشمل مقارنة أكثر دقة بالعمود `sale_type` والـ `shipping_option_index`

### 2. تتويج الفائزين لا يعمل
**السبب الجذري**: الدالة `admin_award_crossy_road_winners` مُعرَّفة بـ **0 arguments** (`pronargs: 0`)، لكن الكود يستدعيها بـ `{ p_next_season_starts_at: startsAt }` — وهذا يُسبب خطأ PostgreSQL مباشرةً.

**الحل**:
- Migration: إعادة إنشاء الدالة لتقبل parameter اختياري `p_next_season_starts_at timestamptz DEFAULT NULL`
- إضافة `SECURITY DEFINER` + التحقق من `has_role(auth.uid(), 'admin')`

### 3. مشاكل الجذوع في Crossy Road
**التحليل**: Log collision logic في السطر 454-471 يبدو صحيحاً نظرياً (لا snapping). المشكلة المحتملة:
- عند مغادرة النهر (سطر 439): `snappedLane = Math.round((visualXBefore - CELL/2) / CELL)` — قد ينتج lane خاطئ إذا كان `playerOffsetX` كبيراً
- الـ `LOG_TOLERANCE = 0.45` مع `LOG_WIDTH = 2.0` يجعل مساحة القبول واسعة جداً، ما قد يجعل اللاعب "يلتقط" جذوعاً بعيدة
- logs تُعاد لحظياً (`log.x > LANES * CELL + 3`) ما يخلق "جذوعاً وهمية" عند wrap-around

**الحل**:
- تقليل `LOG_TOLERANCE` من 0.45 إلى 0.25
- تحسين wrap-around لمنع teleporting مفاجئ
- عند مغادرة النهر: استخدام `visualXBefore` مباشرة بدلاً من `Math.round`

### 4. فراغات على الشاشات الكبيرة + الكاميرا
**الحل**: الكاميرا حالياً تتمركز عند `camera.position.x = (LANES * CELL) / 2` وهو صحيح. المشكلة في الديكور — الأشجار الحالية فقط عند `-2, -4` و `+11, +13` وهذا غير كافٍ للشاشات العريضة جداً. سأوسع نطاق الديكور ليشمل مواقع أبعد (`-6, -8, +15, +17`).

### 5. مقاس Canvas في الجوال
**الحل**: تحسين `computeZoom` للجوال — القيم الحالية `max(28, min(55, ...))` كبيرة قليلاً. سأخفضها لـ `max(25, min(45, ...))`.

### 6. Hero في /category للشاشات الصغيرة
**التحليل**: الكود الحالي (سطر 90-125) يستخدم `flex-row` مع `w-32 sm:w-48` — هذا موجود بالفعل. المشكلة المحتملة أن الـ container عريض (`container mx-auto`) بدون `max-w-lg`. سأضبط المقاسات بشكل أفضل.

### 7. شريط "نفذ من المخزون" على بطاقات /bundles
**التحليل**: الكود الحالي لا يتحقق من نفاد المخزون أصلاً. يجب إضافة query لبيانات المخزون + عرض شريط قطري CSS.

### 8. Skeleton Loading
**التحليل**: `SuspenseLoader` الحالي (سطر 138-165) ثابت — نفس الشكل لكل الصفحات. يجب جعله يتكيف مع المسار.

**الحل**: إنشاء component `RouteAwareSkeleton` يستخدم `window.location.pathname` (بدلاً من `useLocation` الذي لا يعمل داخل Suspense fallback) لعرض skeleton مناسب.

### 9. تحميل الألعاب وفتحها بشكل فردي
**الحل**: الألعاب محملة بـ `lazy()` بالفعل — المشكلة أن `MiniGames.tsx` يقفل `body overflow` ويُشغل `PixelBackground` فوراً. سأؤخر هذا لحين اختيار لعبة.

### 10. تحسين البروفايل
**الحل**: تحسين `ProfileHeader` بتصميم بطاقة ولاء + إضافة شارات + إحصائيات ألعاب.

### 11. تعديل منتجات الطلب لا يعمل
**التحليل**: الكود يستخدم `supabase.from("order_items").delete()` و `.insert()` — لكن **لا توجد RLS policies** للأدمن على جدول `order_items` تسمح بالحذف/التعديل/الإدراج. كذلك دالة `admin_adjust_order_inventory` تحتاج `p_option_id` كمعامل لكن الكود لا يمرره.

**الحل**:
- Migration: إضافة RLS policies للأدمن على `order_items` (DELETE, UPDATE, INSERT)
- تعديل `AdminOrderItemEditor` لتمرير `p_option_id` بشكل صحيح

### 12. قسم الفائزون في لوحة الإدارة
**الحل**: إنشاء صفحة `AdminWinners.tsx` تعرض جميع الفائزين من:
- `crossy_road_winners`
- `stack_game_winners`
- `competition_prizes`
- `knife_rain_winners` (إن وُجد)

مع فلتر حسب اللعبة والتاريخ + زر "تم التسليم".

---

## الملفات المتأثرة

### Migrations:
1. إعادة إنشاء `admin_award_crossy_road_winners` بمعامل اختياري + `SECURITY DEFINER`
2. إضافة RLS policies للأدمن على `order_items` (DELETE, UPDATE, INSERT)

### ملفات موجودة:
- `src/hooks/useCart.tsx` — إصلاح `shipping_option_index` null handling
- `src/components/admin/CrossyRoadTab.tsx` — لا تغيير مطلوب (بعد إصلاح DB)
- `src/components/games/crossy-road/CrossyRoad3DScene.tsx` — تقليل LOG_TOLERANCE، توسيع الديكور
- `src/components/games/crossy-road/CrossyRoadCanvas.tsx` — ضبط zoom الجوال
- `src/pages/CategoryDetail.tsx` — ضبط Hero للجوال
- `src/pages/ProductBundles.tsx` — إضافة شريط نفاد المخزون + query المخزون
- `src/App.tsx` — `RouteAwareSkeleton` بدلاً من SuspenseLoader ثابت
- `src/pages/MiniGames.tsx` — تأخير body lock + pixel background
- `src/pages/Profile.tsx` — تحسين UI + شارات
- `src/components/admin/AdminOrderItemEditor.tsx` — إصلاح RPC call

### ملفات جديدة:
- `src/pages/AdminWinners.tsx` — قسم الفائزون في لوحة الإدارة

