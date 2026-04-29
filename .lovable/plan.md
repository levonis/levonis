## تقسيم `/special-coupons` إلى تبويبَين + زر "استخدام" يفعّل الكوبون فعلياً في السلتَين

### الوضع الحالي (مشكلة)
- صفحة `/special-coupons` تعرض شيئَين مدموجَين بدون فصل:
  1. كوبونات الإدارة (`customer_special_coupons`) — للموقع الرسمي.
  2. خصومات متاجر المجتمع (`merchant_store_discounts`) — للمجتمع.
- **لا يوجد زر "استخدام"**: المستخدم يرى الكوبون فقط ويحتاج نسخ الكود يدوياً.
- **سلة الموقع** (`Cart.tsx`) تطبّق كوبونات الإدارة فقط بإدخال الكود يدوياً.
- **سلة المجتمع** (`CommunityCart.tsx`) لا تدعم الكوبونات/الخصومات إطلاقاً في الـ UI رغم أن `community_cart_items.discount_id` موجود في الـ schema.

### السلوك الجديد

#### 1) صفحة `/special-coupons` — تبويبان أعلى الصفحة
شريط Tabs بنمط Glassmorphism فيه تبويبَين:

**أ) "كوبونات الموقع" (افتراضي)** — يعرض فقط `customer_special_coupons` (كوبونات الإدارة الرسمية):
- كل بطاقة فيها زر **"استخدام في السلة"** (أخضر بارز).
- الضغط: يحفظ الكوبون في `localStorage` تحت مفتاح `pending_site_coupon` ثم ينتقل إلى `/cart` ويعرض toast "تم تفعيل الكوبون — سيُطبَّق في السلة".
- في `Cart.tsx` نضيف `useEffect` يلتقط هذا المفتاح عند التحميل، يضع الكود في `couponCode` ويستدعي `applyCoupon()` تلقائياً، ثم يمسح المفتاح.
- إذا لم يكن للكوبون كود (مثل عرض ضمني)، يُعرض الكود المُولَّد من `coupon_code` field — وإن كان فارغاً نُخفي زر "استخدام" ونعرض "كوبون عرض" فقط.

**ب) "كوبونات المجتمع والتجار"** — يعرض فقط `merchant_store_discounts` (خصومات التجار، مجمّعة حسب المتجر كما حالياً):
- كل بطاقة فيها زر **"استخدام في سلة المجتمع"**.
- الضغط: يحفظ `{ discount_id, merchant_id }` في `localStorage` تحت `pending_community_discount` وينتقل إلى `/community/cart`.
- يعمل التفعيل فقط إذا السلة تحوي منتجات من نفس المتجر؛ وإلا يفتح صفحة المتجر `/community/store/:merchant_id` ليضيف منتجاً أولاً.

#### 2) `Cart.tsx` (سلة الموقع)
- إضافة `useEffect` عند التحميل يقرأ `pending_site_coupon` ويستدعي `applyCoupon` تلقائياً (مع رسالة نجاح/فشل). يُمسح المفتاح بعد المحاولة.
- يستخدم نفس مسار التحقق الحالي `validate_coupon_with_rate_limit` (لا تغيير في الـ RPC).

#### 3) `CommunityCart.tsx` (سلة المجتمع)
- إضافة state: `appliedDiscount` يحمل الخصم المُفعَّل + التحقق من `min_purchase_amount`.
- `useEffect` يقرأ `pending_community_discount`، يجلب الخصم من `merchant_store_discounts` مع التحقق:
  - `is_active = true` و (`valid_until` فارغ أو > الآن).
  - مجموع منتجات هذا التاجر في السلة ≥ `min_purchase_amount`.
- إذا نجح: يحفظ `discount_id` على عناصر السلة الخاصة بهذا التاجر (`UPDATE community_cart_items SET discount_id = ... WHERE merchant_id = ... AND user_id = ...`).
- يُحسب الخصم في الإجمالي بحسب `discount_type`:
  - `percentage` / `min_purchase_percentage`: خصم نسبة من مجموع منتجات التاجر.
  - `fixed_amount`: خصم مبلغ ثابت.
  - `free_delivery` / `min_purchase_delivery`: تصفير `merchantDeliveryPrices[merchant_id]`.
  - `free_gift`: عرض الهدية كـ badge فقط (لا حساب).
- بطاقة Glassmorphism في ملخص السلة تعرض الخصم المُفعَّل + زر إزالة (يمسح `discount_id` من العناصر).
- توست خطأ واضح إذا لم يتحقق الحد الأدنى أو لا توجد منتجات من التاجر.

### الملفات المتأثرة
- `src/pages/CustomerSpecialCoupons.tsx` — إعادة هيكلة بالـ Tabs + زر "استخدام".
- `src/pages/Cart.tsx` — `useEffect` لقراءة `pending_site_coupon` + استدعاء `applyCoupon`.
- `src/pages/CommunityCart.tsx` — منطق جديد لتطبيق الخصم + UI badge + حساب الإجمالي بعد الخصم.
- `src/lib/i18n/{ar,en,ku,types}.ts` — مفاتيح ترجمة جديدة (عناوين تبويبَين، أزرار، رسائل toast).
- لا تغييرات في DB / RPCs.

### نتيجة المستخدم
- يدخل `/special-coupons` → يرى تبويبَين واضحَين.
- يضغط "استخدام" على كوبون الموقع → ينتقل إلى السلة الرسمية وقد طُبِّق الكوبون تلقائياً.
- يضغط "استخدام" على خصم تاجر → ينتقل إلى سلة المجتمع وقد طُبِّق الخصم على منتجات هذا التاجر (إن كانت موجودة)، أو يُوجَّه لإضافة منتجات أولاً.
