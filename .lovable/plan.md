## الهدف
عند تعديل الأدمن أو المساعد لأي سعر (المنتج الأساسي، خيارات/ألوان، عروض)، يظهر السعر الجديد لحظياً لكل المستخدمين دون الحاجة لإعادة تحميل الصفحة.

## الوضع الحالي (ما تم فحصه)
- `products` فقط مُفعّل في `supabase_realtime`.
- `product_options` و `product_offers` و `cart_items` **غير مفعلة** للـ Realtime.
- `useCart.tsx` يستمع لتغييرات `products` للعناصر الموجودة فعلياً في السلة فقط (يُحدّث المخزون لا الأسعار صراحة).
- صفحات `ProductDetail` و `ProductCard` وقوائم المنتجات (Shop, Offers, Categories) لا تشترك في أي قناة Realtime — السعر يبقى ثابتاً حتى تحديث الصفحة.

## خطة التنفيذ

### 1) قاعدة البيانات — تفعيل Realtime
Migration واحدة تضيف الجداول الناقصة للنشر:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.product_options;
ALTER PUBLICATION supabase_realtime ADD TABLE public.product_offers;
ALTER TABLE public.product_options REPLICA IDENTITY FULL;
ALTER TABLE public.product_offers  REPLICA IDENTITY FULL;
ALTER TABLE public.products        REPLICA IDENTITY FULL;
```
(REPLICA FULL يضمن وصول الصفوف القديمة/الجديدة كاملة في حدث UPDATE.)

### 2) Hook موحد جديد `useRealtimePriceSync`
ملف جديد `src/hooks/useRealtimePriceSync.ts`:
- يفتح قناة Supabase واحدة عند تشغيل التطبيق (داخل `App.tsx` أو `CartProvider`).
- يستمع لـ UPDATE على `products` (الأعمدة: `price`, `original_price`, `link_direct_commission_to_cod`)، وعلى `product_options` (`price_adjustment`) وعلى `product_offers` (`offer_price`, `is_active`).
- عند أي حدث: يستدعي `queryClient.invalidateQueries` لـ keys: `['products']`, `['product']`, `['product-offers']`, `['product-options']`, `['cart']`, `['cart-stock-check']`, `['merchant-products']`.
- Debounce بسيط 200ms لتجميع التحديثات المتتابعة.

### 3) تحديث السلة (`useCart.tsx`)
- توسعة المستمع الحالي ليشمل `product_options` و `product_offers` للمنتجات الموجودة في السلة.
- عند رصد فرق في السعر بين `payload.old` و `payload.new` لمنتج موجود في السلة → إظهار **toast صامت صغير عبر `sonner`**:
  > "تم تحديث سعر [اسم المنتج]"
  (مرة واحدة لكل منتج خلال 3 ثوان لتفادي الإزعاج.)

### 4) صفحات العرض
- `ProductDetail.tsx`: الاعتماد على invalidation عبر Hook الموحد — لا حاجة لتعديل مباشر، فقط التأكد أن `queryKey` يبدأ بـ `['product', id]`.
- `ProductCard` وقوائم: الـ invalidation العام سيُجبر React Query على إعادة الجلب لحظياً.

### 5) ضبط الـ Query Keys (تدقيق سريع)
مراجعة أن:
- صفحة المنتج تستخدم `['product', productId]`.
- العروض تستخدم `['product-offers', ...]`.
- إذا وجدت keys مختلفة في صفحات معينة، تتم إضافتها لقائمة الـ invalidations في Hook الموحد.

## التفاصيل التقنية
- لا تغييرات في منطق التسعير نفسه (`computeUnifiedCardPrice` يبقى كما هو).
- لا تغيير في RLS — القراءة العامة للأسعار مسموح بها أصلاً.
- التكلفة: قناة Realtime واحدة عامة لكل عميل + قناة سلة الحالية. خفيف.
- التوافق: عمل تلقائي على الموبايل والديسكتوب، وبدون أي مدخل من المستخدم.

## الملفات المتأثرة
- جديد: `supabase/migrations/<timestamp>_realtime_prices.sql`
- جديد: `src/hooks/useRealtimePriceSync.ts`
- تعديل: `src/App.tsx` (تشغيل الـ Hook مرة واحدة)
- تعديل: `src/hooks/useCart.tsx` (إضافة الاستماع لـ product_options/offers + toast السلة)
