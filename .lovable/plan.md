## المشكلات المكتشفة أثناء التشخيص

| # | المشكلة | السبب الجذري |
|---|---------|---------------|
| 1 | منتجات مخفيّة تظهر للمستخدمين | زر "إخفاء" في الأدمن يقلب `is_pricing_updated` فقط، لكن فلترة `is_pricing_updated=true` مطبَّقة **فقط** في `CategoryDetail`. باقي الاستعلامات (تفاصيل المنتج، منتجات ذات صلة، السلة، محدد المنتجات في المحادثة، الباندلز، الفلمنت العشوائي، LinkRenderer، احتساب "About") لا تفلتر → المخفي يظهر عبر رابط مباشر أو أقسام أخرى |
| 2 | المنتج المخفي يبقى في السلة | لا يوجد أي إعادة تقييم لعناصر السلة عند تغيير حالة الظهور من الأدمن |
| 3 | سعر الخيار/اللون خاطئ في بطاقات التصفح | مكوّنات قديمة (`ProductOfferDetailModal`, `community/AddToCartSheet`, وأي مكان يستخدم النمط القديم `price + price_adjustment`) ما زالت تعامل `price_adjustment` كـ"فارق إضافي" بدلاً من "سعر مستقل" — يخالف المنطق الجديد الموثّق في الذاكرة والمستخدَم في `computeUnifiedCardPrice` |

---

## خطة التنفيذ

### 1) توحيد فلترة الظهور (`is_pricing_updated=true`) لكل استعلامات المنتجات

**دالة مساعدة** جديدة `applyPublicVisibility(query)` في `src/lib/productVisibility.ts` تضيف `.eq('is_pricing_updated', true)`، لضمان مصدر واحد للحقيقة.

**تطبيقها في:**
- `src/pages/ProductDetail.tsx` (الاستعلام الرئيسي سطر 112 + المنتجات ذات الصلة سطر 205)
- `src/pages/ProductBundles.tsx` (سطر 73)
- `src/pages/RandomFilament.tsx` (سطر 542)
- `src/pages/About.tsx` (عدّاد المنتجات سطر 24)
- `src/hooks/useCart.tsx` (استعلامات re-fetch للمنتج سطر 732 و1097)
- `src/components/chat/LinkRenderer.tsx` (سطر 57)
- `src/components/chat/ProductSelector.tsx` (سطر 81)
- `src/components/rewards/OrderLevoCardCta.tsx` (سطر 75)
- `src/components/CompetitionFormDialog.tsx` (سطر 251)
- في `ProductDetail`، عند فتح رابط منتج مخفي مباشرةً → إعادة التوجيه إلى 404/الفئة مع رسالة "المنتج غير متاح"

الاستعلامات الإدارية (`products_admin` و `Admin.tsx` وما شابه) تبقى كما هي.

### 2) إزالة عناصر السلة تلقائياً عند إخفاء المنتج

في `src/hooks/useCart.tsx`:
- عند جلب السلة، إحضار حقل `products.is_pricing_updated` ضمن الـ join.
- تصفية العناصر التي `is_pricing_updated=false` قبل تسليمها للـ UI.
- استدعاء RPC/mutation تحذف صفوف `cart_items` المرتبطة بمنتجات مخفيّة وتُظهر Toast للمستخدم مرّة واحدة: "تم حذف منتج غير متاح من سلتك" (مع اسم المنتج).
- الاشتراك في تغييرات `products` (موجود جزئياً في `useRealtimePriceSync`) لإعادة التقييم فوراً عند إخفاء الأدمن للمنتج بينما السلة مفتوحة.
- نفس المعالجة على السيرفر: `trigger` على `products` عند `is_pricing_updated=false` يحذف صفوف `cart_items` لهذا المنتج (حماية إضافية لمنع الشراء والدفع بالخطأ).

### 3) توحيد سعر الخيار/اللون في كل عرض

- **`ProductOfferDetailModal.tsx`**: يستخدم حالياً `offer.price + selectedOption.price_adjustment` وشارة `(+X)`. سيتم تحويله لاستخدام نفس دلالة المشروع: إذا `price_adjustment > 0` فهو سعر مستقل يحلّ محل السعر، وإلا يُستخدم سعر العرض. إزالة شارة `(+X)`.
- **`src/components/community/AddToCartSheet.tsx`**: نفس التصحيح (استبدال جمع `price + priceAdj` بمنطق الاستقلال).
- **`src/components/admin/MysteryCaseTab.tsx` و `AdminProductOffersTab.tsx`**: هذه شاشات إدارية — يبقى عرض الرقم كما هو **مع تسمية أوضح** ("السعر المستقل للخيار") بدل شارة `+`.
- إجراء بحث شامل لأي مكان يستخدم `product_options[...].price_adjustment` في العرض للتأكد من التوافق مع الدلالة الحالية (المصدر الوحيد للحقيقة: `computeUnifiedCardPrice` و `getGuardedCartItemPrice`).
- إبقاء `computeUnifiedCardPrice` و `getMinOptionOverridePriceIqd` بدون تغيير — منطقهم صحيح حسب توضيحك.

### 4) توثيق ومنع التكرار

- إضافة سطر لملف الذاكرة `mem://features/products/visibility-and-cart-cleanup` يوثّق:
  - `is_pricing_updated=false` = مخفي عن المستخدمين ⇒ يجب فلترته في **كل** استعلام واجهة.
  - عناصر السلة تُحذف تلقائياً (Client + Trigger) لأي منتج يصبح مخفياً.

---

## التفاصيل التقنية

- **قاعدة البيانات**: Trigger جديد `remove_hidden_products_from_carts()` على `products` (AFTER UPDATE OF is_pricing_updated) يحذف `cart_items` عندما يصبح المنتج مخفيّاً.
- **الأداء**: الفلترة تتم عبر فهرس موجود ضمنياً على `is_pricing_updated`؛ سنضيف فهرس جزئي `(is_pricing_updated) WHERE is_pricing_updated = true` إذا لزم لاحقاً.
- **حالات الحافة**:
  - المنتجات في تاريخ الطلبات (`orders`, `order_items`) لا تتأثر — تُعرض دائماً.
  - صفحات الأدمن تبقى تعرض كل المنتجات كالمعتاد.
  - إذا كان عنصر السلة مربوطاً بعرض `product_offers` فقط (بلا `product_id` علني)، فلا يُحذف.

---

## سؤال مطلوب قبل التنفيذ (اختياري)

لو أمكنك مشاركة **مثال محدد** (اسم منتج + خيار/لون + السعر الظاهر) لمشكلة السعر، سأتحقق من الحالة قبل التعديل وأتأكد أنّ الإصلاح يعالجها فعلاً. وإلا سأنفّذ الخطة أعلاه كما هي.