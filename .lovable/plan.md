# مزامنة حذف العناصر منتهية المخزون على مستوى قاعدة البيانات

## المشكلة الحالية
حالياً منطق حذف عناصر السلة عند نفاد مخزون البيع المباشر يعمل **فقط في الواجهة** (`src/pages/Cart.tsx` يستدعي `removeFromCart` الذي بدوره يحذف من `cart_items`). هذا يعني:
- إذا لم يفتح المستخدم صفحة Cart، تبقى العناصر منتهية المخزون في قاعدة البيانات.
- صفحات أخرى تقرأ `cart_items` (Checkout، الشريط العلوي، شارة العداد) قد ترى عناصر يجب أن تكون محذوفة.
- الحساب يتم بالكامل في JavaScript مع إمكانية تباين بسيط بين منطق الواجهة ومنطق قاعدة البيانات.

## الهدف
ضمان حذف العنصر على مستوى قاعدة البيانات بمجرد وصول مخزون البيع المباشر إلى الصفر، بغض النظر عن الصفحة التي يتصفحها المستخدم.

## التنفيذ

### 1. Migration جديد: `purge_oos_direct_cart_items` RPC
دالة `SECURITY DEFINER` تأخذ `p_user_id uuid` (افتراضياً `auth.uid()`) وتقوم بـ:

- جلب كل `cart_items` للمستخدم حيث `sale_type = 'direct'` و `product_id IS NOT NULL` (تستثني RF و bundles و locked).
- لكل عنصر تحسب المخزون المتاح من `products.colors` / `option_stocks` / `direct_stock` بنفس منطق `getItemAvailableStock` في الواجهة:
  - إذا لم يكن للمنتج ألوان → استخدم `direct_stock`.
  - إذا كان `selected_color` محدد → ابحث عن اللون، تحقق من `available_for_direct_sale`، ثم اقرأ `option_stocks[product_option_id]` أو مجموع `option_stocks`، أو `stock_quantity`.
  - بدون لون محدد → اجمع كل الألوان المؤهلة للبيع المباشر.
- إذا كان المتاح `<= 0` → احذف الصف من `cart_items`.
- ترجع `jsonb` يحتوي مصفوفة العناصر المحذوفة `[{id, product_id, product_name}]` لاستخدامها في عرض إشعارات للمستخدم.

تمنح `EXECUTE` للأدوار `authenticated` فقط، مع حماية `p_user_id = auth.uid()` داخلياً (يرفض إذا حاول مستخدم تمرير id آخر).

### 2. تحديث `src/pages/Cart.tsx`
- استبدال حلقة `removeOutOfStockItems` و `useEffect` التلقائي بنداء واحد لـ:
  ```ts
  const { data } = await supabase.rpc('purge_oos_direct_cart_items');
  ```
- استدعاؤه في:
  - `useEffect` على mount.
  - دوري مع interval الفحص الموجود حالياً (نفس الـ refetch القائم لـ `cart-stock-check`).
  - بعد أي `refetch` لبيانات المخزون عندما يكتشف المنطق المحلي عناصر `outOfStockItemIds`.
- لكل عنصر مُعاد في الاستجابة، إظهار `sonnerToast.error` بنفس النص الحالي (`cart_out_of_stock_warning`).
- استخدام `oosNotifiedRef` كما هو الآن لمنع تكرار التنبيه.
- بعد النجاح، استدعاء `refetch` لبيانات السلة (`useCart` يتعامل مع realtime لكن استدعاء صريح يضمن التحديث الفوري).

### 3. تحديث `src/hooks/useCart.tsx` (اختياري خفيف)
إضافة استدعاء لـ `purge_oos_direct_cart_items` داخل خطوة تحميل السلة الأولية (`fetchCart`) قبل قراءة `cart_items`، لضمان أن أي صفحة (وليس Cart فقط) تبدأ بسلة نظيفة. لا تغيير في الواجهة الخارجية.

### 4. تحديث `src/integrations/supabase/types.ts`
إضافة توقيع الدالة الجديدة `purge_oos_direct_cart_items` ضمن `Functions`.

## ملاحظات تقنية
- لا حاجة لـ Edge Function؛ Postgres RPC كافٍ ويُستدعى مباشرة عبر `supabase.rpc(...)` من المتصفح.
- العملية idempotent: إذا لم يوجد ما يُحذف ترجع مصفوفة فارغة.
- لا تُمَس عناصر RF، locked، bundles، أو preorder.
- لا تأثير على `WHERE true` أو سياسات RLS الموجودة لأن الحذف يتم عبر `SECURITY DEFINER` المحدود بـ `auth.uid()`.

## الملفات المتأثرة
- جديد: `supabase/migrations/<timestamp>_purge_oos_direct_cart_items.sql`
- تعديل: `src/pages/Cart.tsx`
- تعديل خفيف: `src/hooks/useCart.tsx`
- تحديث تلقائي: `src/integrations/supabase/types.ts`
