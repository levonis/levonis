
## القاعدة الجديدة

- **الكسب**: `1 نقطة = 1 دينار` تُمنح بمعدل **1 نقطة لكل 1000 د.ع** من الإنفاق الصافي.
- **الأساس المحسوب** (لكل طلب) = `subtotal − discount_amount` (بعد الكوبون والخصومات، بدون التوصيل/رسوم COD/التبرع).
- **التوقيت**: عند تأكيد الاستلام (`user_confirmed_delivery = true` أو `auto_confirmed = true`)، وليس عند تغيير الحالة إلى `delivered`.
- **الاستخدام في السلة**: بدون حد أقصى — حتى تغطية كامل قيمة السلة.

## تغييرات قاعدة البيانات (migration)

1. **حذف السلوك القديم**:
   - `DROP TRIGGER` الذي يستدعي `award_points_on_delivery` على جدول `orders` (منح فوري عند delivered).
   - إبقاء الدالة كأرشيف أو حذفها.
2. **دالة جديدة** `award_points_on_confirm()` (SECURITY DEFINER):
   - تعمل عند `UPDATE` على `orders` حين ينتقل `user_confirmed_delivery` من false→true أو `auto_confirmed` من false→true.
   - تحسب: `earned = FLOOR( (subtotal − COALESCE(discount_amount,0)) / 1000 )`.
   - تضيف علاوة بطاقة الولاء (`bonus_points_percentage`) كما هو الآن.
   - Idempotent: تتحقق أنه لا يوجد `points_transactions` سابق بـ `source='order_delivered'` و `related_id=order.id`.
   - تُدرج المعاملة و تحدّث `user_points`.
3. **أعمدة جديدة على `orders`**:
   - `points_redeemed INTEGER DEFAULT 0` (كم نقطة استُخدمت خصماً في هذا الطلب)
   - `points_discount_amount NUMERIC DEFAULT 0` (قيمة الخصم د.ع = points_redeemed)
   - `points_earned INTEGER DEFAULT 0` (كم نقطة كسبها عند تأكيد الاستلام — للعرض في الإدارة)
4. **RPC جديد** `redeem_points_in_cart(p_user_id uuid, p_order_id uuid, p_points int)`:
   - SECURITY DEFINER، يتحقق من available_points، يخصم من `user_points`، يُدرج `points_transactions` بنوع `spent` و `source='cart_redemption'`، ويحدّث الطلب.
   - يضاف `'cart_redemption'` إلى check constraint في `points_transactions.source`.
5. **حذف الحقل اليدوي** `products.points_reward` و `product_offers.points_reward`:
   - `ALTER TABLE ... DROP COLUMN points_reward` بعد إزالة كل مراجعه في الكود.
6. **تعويض العملاء القدامى** (تشغيل مرة واحدة ضمن نفس الـmigration):
   - لكل طلب `orders` بـ `status='delivered'` (89 طلب): حساب `should_earn = FLOOR((subtotal − discount_amount)/1000)` + علاوة الولاء.
   - جمع كل `points_transactions` القديمة بـ `source IN ('order','order_delivered')` و `related_id=order.id` → `already_awarded`.
   - إذا `should_earn > already_awarded` → إضافة الفرق بمعاملة جديدة `source='order_delivered'` و description = `"تعويض النظام الجديد لطلب X"` وتحديث `user_points`.

## تغييرات الكود

### إزالة/تنظيف
- `src/pages/Admin.tsx`: حذف حقل input `points_reward` وحقل formData والاستخراج التلقائي منه.
- `src/pages/AdminProductOffers.tsx`: حذف حقل `points_reward` من الفورم والعرض.
- `src/pages/AdminDeliveredOrders.tsx`: قراءة `points_awarded` من عمود الطلب الجديد بدلاً من `products.points_reward`.
- `src/pages/ProductDetail.tsx`: عرض النقاط المحسوبة تلقائياً `Math.floor(price/1000)` بدلاً من `product.points_reward`.
- `src/pages/AdminPointsSettings.tsx`: حذف حقول `points_per_order` و `order_value_multiplier` من إعدادات النقاط.

### إضافة استخدام النقاط في السلة `src/pages/Cart.tsx`
- Query لجلب `user_points.available_points`.
- بطاقة جديدة في ملخص السلة: Toggle "استخدام النقاط للخصم" + input عدد النقاط (max = min(available_points, subtotalWithTax)).
- حساب `pointsDiscount` وطرحه من `finalTotal`.
- عند إنشاء الطلب: تمرير `points_redeemed` و `points_discount_amount` لجدول الطلب، ثم استدعاء RPC `redeem_points_in_cart` بعد نجاح إنشاء الطلب (Atomic).
- إظهار السطر "خصم النقاط: -X د.ع" في ملخص السلة.

### عرض الإدارة `src/pages/AdminOrders.tsx` / `OrderDetail.tsx`
- إضافة سطر واضح "خصم نقاط: -X د.ع (Y نقطة)" داخل تفاصيل الطلب عندما `points_redeemed > 0`.

## التفاصيل التقنية

```text
Points earned = FLOOR( max(0, subtotal − discount_amount) / 1000 ) × (1 + loyalty_bonus%/100)
Points redemption: 1 point = 1 IQD, max = subtotalWithTax
Trigger: AFTER UPDATE ON orders WHEN user_confirmed_delivery becomes true
```

## الملفات المعدَّلة
- Migration جديد (schema + backfill).
- `src/pages/Cart.tsx` (استخدام النقاط + توليد الطلب مع points_redeemed).
- `src/pages/Admin.tsx` (حذف حقل points_reward).
- `src/pages/AdminProductOffers.tsx` (حذف حقل points_reward).
- `src/pages/AdminPointsSettings.tsx` (حذف حقول قديمة).
- `src/pages/AdminDeliveredOrders.tsx` (تحديث المصدر).
- `src/pages/AdminOrders.tsx` أو ما يعادلها + `src/pages/OrderDetail.tsx` (عرض خصم النقاط للإدارة والمستخدم).
- `src/pages/ProductDetail.tsx` (عرض النقاط المحسوبة تلقائياً).
