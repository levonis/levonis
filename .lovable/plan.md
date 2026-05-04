## الحالة الحالية

- **السلة (Cart.tsx + GroupedCartItem.tsx)**: عناصر الفلمنت العشوائي تُعرض بصورة المفاجأة (WavyColors + Sparkles) واسم "فلمنت عشوائي". الكود يتحقق من `is_random_filament` ويُخفي شارات اللون/الخيار/الشحن. لا يوجد تسريب لهذه التفاصيل في الواجهة قبل الكشف.
- **العرض في تفاصيل الطلب (`OrderDetail.tsx`)**: يستخدم `revealed_at` من جدول `random_filament_orders`؛ قبل الكشف يعرض صورة المفاجأة، وبعده يظهر المنتج/اللون/الخيار.
- **منطق الكشف الحالي في DB** (آخر هجرة `20260504205130`):
  - `auto_reveal_rf_on_payment` → ينادي `finalize_and_reveal_rf_for_order(NEW.id)` لكل عناصر RF عند `payment_status='paid'`.
  - `auto_reveal_rf_on_delivery` → نفس الشيء عند `delivered` أو `user_confirmed_delivery`.
- **المشكلة**: حالياً الدفع من المحفظة (الذي يضع `payment_status='paid'`) يكشف **كل** عناصر RF بما فيها البيع المباشر، بينما المطلوب أن البيع المباشر لا يُكشف إلا عند تحوّل الطلب إلى "تم التوصيل".

## التغييرات المطلوبة

### 1) قاعدة البيانات (هجرة جديدة)

تعديل `finalize_and_reveal_rf_for_order` ليقبل وسيطًا اختياريًا `p_only_sale_type text` يفلتر الـ `order_items` المؤهلة عبر `JOIN random_filament_offers` على `sale_type`.

ثم تعديل المُحفِّزات (triggers) بحيث:

- `auto_reveal_rf_on_payment` ← يستدعي `finalize_and_reveal_rf_for_order(NEW.id, 'preorder')` فقط (الحجز المسبق).
- `auto_reveal_rf_on_delivery` ← يستدعي `finalize_and_reveal_rf_for_order(NEW.id, NULL)` (يكشف البيع المباشر + أي بقايا حجز مسبق لم تُكشف لأي سبب، كاحتياط).

النتيجة:
- دفع المحفظة لطلب حجز مسبق ⇒ كشف فوري.
- دفع المحفظة لطلب فيه بيع مباشر ⇒ يبقى الفلمنت مفاجأة.
- عند `status='delivered'` أو `user_confirmed_delivery=true` ⇒ يُكشف البيع المباشر.

### 2) الواجهة

السلة و`OrderDetail` يعتمدان على `is_random_filament` و`revealed_at`، فلا حاجة لتغيير الواجهة. إخفاء اللون/الخيار قبل الكشف يعمل تلقائيًا بفضل تأخر إدراج الصف في `random_filament_orders`.

## التفاصيل التقنية

```text
Trigger flow after change
───────────────────────────────────────────────
orders.payment_status='paid'
  └─ auto_reveal_rf_on_payment
       └─ finalize_and_reveal_rf_for_order(order_id, 'preorder')
            (يلتقط فقط oi.rf_offer_id حيث offers.sale_type='preorder')

orders.status='delivered' OR user_confirmed_delivery
  └─ auto_reveal_rf_on_delivery
       └─ finalize_and_reveal_rf_for_order(order_id, NULL)
            (كل ما تبقى — بما فيه 'direct')
```

ملف الهجرة سيُعيد إنشاء الدالة بنفس جسمها الحالي مع إضافة المعامل والـ JOIN، ويستبدل جسم المُحفّزَين فقط (لا تغيير في باقي وظائف RF).

## ملخص الملفات

- جديد: `supabase/migrations/<timestamp>_split_rf_reveal_by_sale_type.sql`
- لا تغييرات على الواجهة.
