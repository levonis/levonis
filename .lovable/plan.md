## السبب الجذري

عرض `products_admin` (والذي تستخدمه صفحة الإدارة لجلب المنتجات) يقوم بإخفاء حقول التكلفة/العمولة عندما يكون المستخدم **ليس أدمن**:

```sql
CASE WHEN has_role(auth.uid(), 'admin') THEN cost_price ELSE NULL END AS cost_price
```

نفس الشيء لـ: `cost_price`, `commission_iqd`, `commission_sea_iqd`, `commission_air_iqd`, `commission_direct_iqd`, `shipping_cost_iqd`, `other_costs_iqd`, `personal_delivery_cost`, `referral_earnings_iqd`.

**النتيجة للمساعد:**
1. عند فتح المنتج → الحقل يصل كـ `NULL` فيظهر فارغاً.
2. المساعد يدخل قيمة → الحفظ في جدول `products` ينجح فعلياً (RLS وGRANT يسمحان).
3. بعد إعادة الجلب، العرض يعيد `NULL` مرة أخرى → يبدو وكأن القيمة لم تُحفظ/لم تظهر.

(أما تكلفة الألوان `cost_usd` داخل JSON `colors` فالعرض يمررها مباشرة دون إخفاء، ومع ذلك تختفي حالياً لأن الصفحة تعيد بناء `colors` من نفس المنتج المجلوب من العرض — وحالياً يعمل بشكل صحيح؛ إذا كان المساعد يلاحظ ضياعها فالسبب نفسه: refetch لا يظهر السعر الأساسي فيُربك UI أحيانا، أو السبب أن RLS لـ UPDATE الكامل يعتمد على has_role assistant وهو موجود ويعمل).

## الإصلاح المقترح

تعديل عرض `products_admin` ليكشف حقول التكلفة/العمولة للأدمن **والمساعد** معاً، مع إبقائها مخفية عن باقي المستخدمين الموثّقين.

### تغيير الـ Migration

استبدال شرط الإخفاء في كل CASE من:
```sql
WHEN has_role(auth.uid(), 'admin')
```
إلى:
```sql
WHEN has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'assistant')
```

تطبق على الحقول:
`cost_price`, `shipping_cost_iqd`, `commission_iqd`, `other_costs_iqd`, `commission_sea_iqd`, `commission_air_iqd`, `commission_direct_iqd`, `personal_delivery_cost`, `referral_earnings_iqd`.

سيتم بإعادة تعريف العرض بأكمله (CREATE OR REPLACE VIEW) مع `security_invoker=on` كما هو حالياً.

### تحديث الذاكرة

تحديث memory `mem://security/access-control/products-cost-fields-hidden` لتوضيح أن المساعدين أيضاً يرون حقول التكلفة (لأنهم يديرون المنتجات).

## التحقق

1. تسجيل دخول بحساب مساعد، فتح منتج موجود، تأكيد ظهور قيمة التكلفة المحفوظة سابقاً.
2. تعديل التكلفة، حفظ، إعادة فتح، تأكيد بقاء القيمة.
3. إضافة منتج جديد بتكلفة من حساب مساعد، فتحه مرة أخرى، تأكيد بقاء التكلفة.
4. تسجيل دخول بحساب عادي (غير مساعد/أدمن) والتأكد أن التكلفة لا تزال مخفية (لا تسرّب).

## ملاحظة قبل التنفيذ

هل تريد أيضاً تطبيق نفس المنطق على:
- `product_offers_admin` (تكلفة العروض `cost_price`)
- `orders_admin` / `order_items_admin` (حقول التكلفة والربح في الطلبات)

أم نقتصر الآن فقط على المنتجات؟