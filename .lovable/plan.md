

# نظام كوبون الإحالة الخاص ببطاقة Levo VIP Plus + إصلاح البندلات

## نظرة عامة
استبدال خيار "الاستثمار في التطبيق" في بطاقة VIP Plus بنظام **كود دعوة شخصي** يمنح الأصدقاء توصيلاً مجانياً ويُعيد لصاحب البطاقة عمولة من كل منتج. مع لوحة تحكم خاصة، إدارة كاملة من الأدمن، وانعكاس صحيح في القسم المالي. بالإضافة لإصلاح ظهور منتجات البندل في إدارة الطلبات.

---

## 1. قاعدة البيانات (Migration)

### جداول جديدة
```sql
-- كوبونات الإحالة الخاصة بأصحاب VIP Plus
referral_coupons (
  id uuid PK,
  owner_user_id uuid (صاحب البطاقة),
  code text UNIQUE (افتراضياً = username),
  is_active bool,
  expires_at timestamptz,
  total_uses int default 0,
  total_earnings_iqd numeric default 0,
  created_at, updated_at
)

-- استخدامات الكوبون (سجل لكل طلب)
referral_coupon_usages (
  id uuid PK,
  coupon_id uuid FK,
  order_id uuid FK,
  buyer_user_id uuid,
  delivery_discount_iqd numeric (قيمة التوصيل المجاني),
  owner_earnings_iqd numeric (مجموع الأرباح من المنتجات),
  status text ('pending'|'confirmed'|'paid'|'cancelled'),
  created_at
)

-- طلبات سحب الأرباح
referral_earnings_withdrawals (
  id uuid PK, owner_user_id, amount_iqd, status, requested_at, processed_at
)
```

### أعمدة جديدة
- `products.referral_earnings_iqd` numeric default 0 — ربح صاحب البطاقة لكل وحدة
- `orders.referral_coupon_id` uuid nullable
- `orders.referral_owner_earnings_iqd` numeric default 0

### RLS
- صاحب الكوبون: يقرأ كوبوناته واستخداماته فقط
- المشتري: يقرأ المستخدمات لطلبه فقط
- الأدمن: كامل الصلاحيات
- دالة `apply_referral_coupon(p_code, p_order_total)` SECURITY DEFINER ترجع `{valid, owner_username, free_delivery: true}`

---

## 2. لوحة الأدمن

### في تعديل/إضافة منتج (`AdminProductPricingSection.tsx`)
- حقل جديد: **"ربح صاحب بطاقة VIP Plus من كوبون الإحالة (د.ع لكل وحدة)"**
- يُحفظ في `products.referral_earnings_iqd`

### في إدارة الطلبات (`AdminOrders.tsx` / `OrderDetailsDialog`)
عند وجود `referral_coupon_id`:
- شارة: 🎟️ "كوبون إحالة: @username"
- "التوصيل: 0 د.ع (كان 6,000) — مجاني عبر الكوبون"
- "أرباح صاحب الكوبون: 1,250 د.ع"
- **المبلغ المتبقي للدفع نقداً = 96,250** (واضح في الأعلى)

### تفاصيل الدفع الموسعة (زر "إظهار تفاصيل الدفع")
- إذا دُفع من المحفظة: **"رصيد قبل: 100,000 → بعد: 50,000 (دُفع: 50,000)"**
- تاريخ آخر شحن للمحفظة قبل الطلب + المبلغ المشحون
- تفصيل: نقد / محفظة / كوبون

---

## 3. صفحة المالك (`/my-referral` — رابط مشفر)

تفتح بعد شراء بطاقة VIP Plus بدلاً من "ترقية العضوية":
- **الكود الحالي** (افتراضياً username) + زر تعديل + نسخ + مشاركة
- إحصائيات: عدد الاستخدامات، إجمالي الأرباح، الرصيد القابل للسحب
- **جدول المستخدمين**: المستخدم • التاريخ • قيمة الطلب • أرباحك
- تاريخ انتهاء صلاحية الكوبون (مرتبط بانتهاء البطاقة)
- زر **سحب الأرباح** → ينشئ `referral_earnings_withdrawals`
- تصميم أنيق ثلاثي الأبعاد بنفس روح بطاقة VIP+

### تعديل بطاقة VIP Plus (`UserLoyaltyCard` / Rewards Panels)
- إزالة "الاستثمار في التطبيق" من ميزات VIP+
- إضافة "كود دعوة خاص + عمولة من المبيعات"
- زر CTA: "إدارة كود الدعوة" → `/my-referral`

---

## 4. السلة (`Cart.tsx`)

في حقل كوبون الخصم الحالي:
- عند إدخال كود إحالة صالح → استدعاء `apply_referral_coupon`
- إذا صالح: تطبيق توصيل مجاني + رسالة:
  > 🎁 **شكراً لدعمك @username! لقد أهدى لك توصيلاً مجانياً**
- المنع: لا يمكن استخدام كود المستخدم لنفسه
- عند إنشاء الطلب: حفظ `referral_coupon_id` + حساب `referral_owner_earnings_iqd = Σ(item.qty × product.referral_earnings_iqd)`

---

## 5. القسم المالي (`AdminFinancials.tsx`)

تحديث `calcNetRevenue` لكل طلب:
```
العائد الصافي = total - cost - actual_delivery_cost - referral_owner_earnings_iqd
```
عرض سطر منفصل: **"عمولة كوبون الإحالة: -1,250 د.ع"**

---

## 6. إصلاح البندلات في إدارة الطلبات

**المشكلة**: `AdminOrders` يجلب `order_items.products` فقط؛ عناصر البندل تأتي بـ `bundle_id` و `product_id = null` فتظهر "لا توجد منتجات".

**الحل**:
- تعديل استعلام `order_items` ليجلب: `products(*), bundles:bundle_id(id, name_ar, image_url, bundle_items(product_id, quantity, products(name_ar, image_url)))`
- في عرض العنصر: إذا `bundle_id` موجود → عرض اسم البندل + قائمة منتجاته الفرعية (الاسم، الكمية، الصورة)
- نفس التعديل في `OrderDetailsDialog` و `AdminOrderItemEditor` إذا لزم

---

## الملفات المتأثرة

| الملف | التغيير |
|-------|---------|
| Migration SQL | جداول + أعمدة + RLS + RPC |
| `src/components/admin/AdminProductPricingSection.tsx` | حقل referral_earnings_iqd |
| `src/pages/Admin.tsx` | حفظ الحقل |
| `src/pages/Cart.tsx` | تطبيق كود الإحالة + رسالة الشكر |
| `src/pages/MyReferral.tsx` | جديد — لوحة المالك |
| `src/App.tsx` | route `/my-referral` |
| `src/components/UserLoyaltyCard.tsx` + Rewards panels | استبدال الاستثمار بالإحالة |
| `src/pages/AdminOrders.tsx` + `OrderDetailsDialog` | عرض كوبون الإحالة + تفاصيل الدفع + إصلاح البندلات |
| `src/pages/AdminFinancials.tsx` | خصم عمولة الإحالة من العائد |
| `src/i18n/*` | مفاتيح الترجمة الجديدة |

