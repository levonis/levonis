

# عرض الجزيرة العائمة بشكل ذكي + انميشن انكماش/تمدد

تنظيف ظهور الجزيرة لتظهر فقط على صفحات التسوّق والمجتمع، مع انتقال انكماش ناعم عند الاختفاء وتمدد عند الظهور، مع التأكد من أن محتوى الإعلانات (promo) يظهر داخل الجزيرة نفسها.

## السلوك المطلوب

### 1) الصفحات التي تظهر فيها الجزيرة (visible)
- `/` و `/home` (الرئيسية)
- `/products` , `/product/:slug`
- `/categories` , `/category/:slug`
- `/bundles` , `/bundles/:id`
- `/favorites`
- `/community` (ومسارات المجتمع للتصفّح: `/community/merchants/*`, `/community/requests/*`, `/community/reels`)
- `/profile/:username` و `/seller/:username` (الملفات العامة)

### 2) الصفحات التي تختفي فيها الجزيرة (hidden)
- `/cart` (السلة)
- `/rewards` (المكافآت)
- `/games`, `/games/winners` (الألعاب)
- `/chats`, `/community/messages` (المحادثات)
- `/notifications`, `/notification-settings`, `/telegram-settings` (الإشعارات والإعدادات)
- `/profile/settings`, `/user-info`, `/addresses` (إعدادات الحساب)
- `/my-orders`, `/order/:id`, `/my-orders/:id/confirm` (الطلبات)
- `/community/cart`, `/community/checkout/*` (سلة المجتمع والدفع)
- `/community/customer/dashboard`, `/community/merchant/dashboard`, `/community/customer/profile` (لوحات المستخدم)
- `/auth`, `/admin/*` (المصادقة والإدارة)
- `/my-requests`, `/my-referral`, `/my-purchased`, `/my-offer-purchases`, `/confirm-delivery`, `/activate-printer`, `/warranty-dashboard`, `/download`, `/printer-protection`

### 3) محتوى الإعلانات (promo) داخل الجزيرة
- حالة `promo` (الـmarquee التي تعرض رسائل من جدول `announcements`) موجودة فعليًا داخل الجزيرة، ولا حاجة لتغييرها.
- توسيع تشغيلها بحيث تظهر افتراضيًا (قبل التمرير) على كل سطوح التسوّق الرئيسية: `/`, `/products`, `/categories`, `/bundles`, `/favorites`, `/community`, `/community/merchants/*`, `/community/requests/*` — ما دامت `promoMessages.length > 0`. وعند التمرير لأسفل تتحوّل إلى شريط البحث كما في السابق.
- في صفحات التفاصيل (`/product/:slug`, `/category/:slug`) تبقى الحالة `product`/`category` بزر الرجوع كما هي.

### 4) انميشن الانكماش/التمدد عند تبديل الظهور
- عند الانتقال إلى صفحة مخفية: الجزيرة تنكمش بسلاسة (`width → 28px`, `height → 0`, `opacity → 0`, `scale → 0.85`, `borderRadius → 14`) ثم تُزال من الـDOM عبر `AnimatePresence`.
- عند العودة إلى صفحة ظاهرة: تظهر بنفس الانتقال بالعكس مع spring ناعم (نفس `shellSpring` الحالي: `stiffness 260, damping 28, mass 0.95`) — squash خفيف ثم تمدد إلى الحجم الكامل.
- يُستخدم `motion.div` خارجي بـ `initial={{height: 0, opacity: 0, scale: 0.85}}` و `animate={{height: 'auto', opacity: 1, scale: 1}}` و `exit` معكوس — يلفّ الـmount/unmount بالكامل حتى لا يحدث pop مفاجئ.
- المساحة العلوية (`paddingTop: 64`) في `<main>` تتحرّك أيضًا بسلاسة عند الإخفاء (تنزل إلى `0`) عبر CSS `transition: padding 280ms cubic-bezier(.32,.72,0,1)`.

## الملفات المتأثّرة

| الملف | التعديل |
|---|---|
| `src/island/IslandContext.tsx` | إضافة قائمة `HIDDEN_PREFIXES` ودالة `isIslandHidden(path)`، تصدير `visible` ضمن قيمة السياق، وتوسيع `routeDefault` لتفعيل حالة `promo` على سطوح التسوّق والمجتمع. |
| `src/island/DynamicIsland.tsx` | قراءة `visible` من السياق ولفّ الجزيرة بـ `<AnimatePresence>` خارجي + `motion.div` بـ `initial/animate/exit` لانكماش وتمدد ناعم. عند `!visible` لا يُرندَر شيء داخل الـpresence. |
| `src/App.tsx` | حذف الـ flag المحلية `hideChrome` للجزيرة (تبقى للـreels فقط داخل `IslandProvider`)؛ السماح بـ `<DynamicIsland />` بشكل دائم تحت `IslandProvider` (هي ستخفي نفسها). تحريك `paddingTop` في `<main>` ليصبح ديناميكيًا حسب `visible` عبر هوك صغير `useIsland` أو CSS variable. |

## ملاحظات تقنية

- الفحص يعتمد `startsWith` لأن مسارات مثل `/order/abc` و `/games/winners` يجب أن تُخفي.
- ترتيب الفحص: المسارات المخفية أولاً → ثم تحديد الحالة. هكذا لو ظهرت مسارات إدارية فرعية تظل مخفية تلقائيًا.
- لا يُستخدم `lazy` للجزيرة (تبقى مدمجة بـ `import` مباشر) لضمان عدم وميض عند العودة لصفحة مرئية.
- الانتقال يستخدم نفس `shellSpring` الحالي للحفاظ على إحساس apple-style موحّد بين كل التحويلات.

