
## هدف التعديل
جعل بطاقة ليفو النظام الأساسي لفتح كل الميزات مع إعادة تسمية البطاقات، تسعير ثابت للمدد، إضافة خصم عمولة COD، وقفل صفحات المحتوى الحصري.

---

## 1) قاعدة البيانات (migration واحدة)

### أ) إعادة تسمية البطاقات القائمة (UPDATE — لا يوجد فقدان بيانات للمشتركين)
- `card_key='levo'` → name_ar = **ليفو بلس**، card_key = **levo_plus_new** (تجنب التصادم مؤقتاً)، wallet_price = 25000
- `card_key='levo_plus'` → name_ar = **ليفو برو**، card_key = **levo_pro**، wallet_price = 45000
- `card_key='levo_vip'` → name_ar = **ليفو التمت**، card_key = **levo_ultimate**، is_purchasable = false، is_vip_plus = true
- ثم rename `levo_plus_new` → `levo_plus`

### ب) أعمدة جديدة على `membership_cards`
- `cod_commission_discount_percentage` NUMERIC DEFAULT 0 (نسبة الخصم من عمولة الدفع عند الاستلام؛ 0-100)
- تعيين القيم: بلس = 50، برو = 100، التمت = 100

### ج) عمود جديد على `subscription_duration_tiers`
- `fixed_price_iqd` NUMERIC NULL (سعر نهائي ثابت لكل مدة/بطاقة عند وجوده يتجاوز نسبة الخصم)
- `card_id` UUID NULL REFERENCES membership_cards(id) (لربط التسعير ببطاقة محددة، NULL = عام)

### د) صفوف tiers الجديدة (target_type='card')
| البطاقة | 1 شهر | 3 أشهر | 6 أشهر | 12 شهر |
|---|---|---|---|---|
| ليفو بلس | 25,000 | 70,000 | 125,000 | 200,000 |
| ليفو برو | 45,000 | 125,000 | 225,000 | 400,000 |

- إدراج ٨ صفوف جديدة بـ `card_id` معيّن و`fixed_price_iqd`
- تعطيل الصفوف العامة القديمة (`is_active=false`) لتفادي التعارض

### هـ) تحديث RPC حساب سعر الاشتراك
- `calculate_subscription_price` (إن وُجد) يبحث أولاً عن tier بـ card_id مطابق ثم fallback للعام؛ يستخدم `fixed_price_iqd` عند توفره.

---

## 2) قفل الصفحات الحصرية

### `src/pages/ProductBundles.tsx`
- استدعاء `useActiveLevoCard`؛ إذا لا يوجد بطاقة فعّالة: إعادة توجيه (`Navigate`) إلى `/membership-cards` مع state يحمل reason='bundles_locked' لعرض بانر.

### `src/pages/RandomFilament.tsx` (أو ما يقابلها)
- نفس المنطق مع reason='random_filament_locked'.

### `src/pages/MembershipCards.tsx`
- قراءة location.state.reason وعرض بانر ملوّن أعلى الصفحة برسالة تشجيعية مناسبة (بندل / فلمنت عشوائي / تفعيل طابعة / تأمين).

### أقسام الصفحة الرئيسية
- تبقى كما هي بعد آخر تحديث (مخفية بدون بطاقة فعّالة).

---

## 3) خصم عمولة الدفع عند الاستلام (COD)

### `src/hooks/useCodDefaults.ts` أو hook جديد `useCardCodDiscount`
- قراءة `cod_commission_discount_percentage` من بطاقة المستخدم الفعّالة عبر `useActiveLevoCard` (تحديث الاستعلام لجلب الحقل).

### `src/pages/Cart.tsx` + `src/lib/orderFinancials.ts`
- عند حساب عمولة COD (المذكورة في memory `direct-sale-linked-to-cod`): طبّق الخصم = `commission * (1 - percentage/100)` وأظهر سطر "خصم عمولة COD (بطاقة ليفو برو)" في breakdown السلة.

### `src/pages/AdminMembershipCards.tsx` (لو موجودة، وإلا `AdminLoyaltyLevels` أو صفحة الإدارة المطابقة)
- إضافة حقل input لتعديل النسبة من لوحة الأدمن.

---

## 4) التحقق من ربط باقي الميزات (لا تعديل مطلوب — فقط فحص)

| الميزة | الحالة |
|---|---|
| تفعيل الطابعة بالسيريل | صفحة `/rewards?tab=insurance&sub=activate` — يجب إضافة `useActiveLevoCard` guard في `PrinterActivationPanel` مع بانر "يتطلب بطاقة ليفو" |
| تفعيل التأمين | مربوط فعلياً في `AddInsuranceDialog` (`plan.requires_active_card`) ✓ |
| تذاكر ألعاب يومية | مربوط بـ `useVipFreePlay` + `free_daily_games` ✓ (يحتاج التأكد أن ليفو بلس = 1، برو = 2، التمت = 5 وهذا مضبوط بالفعل) |
| خصم 10٪ فلمنت | `discount_percentage` + `discount_applicable_category_ids` ✓ |
| توصيل مجاني اعتيادي | `free_shipping` + `free_shipping_methods` ✓ |

---

## 5) الترجمات
إضافة مفاتيح في `src/lib/i18n/ar.ts`, `en.ts`, `ku.ts`:
- `bundles_locked_banner`, `random_filament_locked_banner`
- `cod_commission_discount_label`
- `printer_activation_requires_card`

---

## تفاصيل تقنية

**قائمة الملفات:**
- migration جديدة (rename + أعمدة + tiers + RPC)
- `src/hooks/useActiveLevoCard.ts` (توسيع select ليشمل حقول COD والصلاحيات)
- `src/pages/ProductBundles.tsx`, `src/pages/RandomFilament.tsx` (guards)
- `src/pages/MembershipCards.tsx` (بانر التوجيه)
- `src/pages/Cart.tsx` + `src/lib/orderFinancials.ts` (خصم COD)
- `src/components/rewards/panels/PrinterActivationPanel.tsx` (guard + بانر)
- `src/pages/AdminMembershipCards.tsx` أو ما يعادلها (حقل النسبة)
- ملفات i18n الثلاثة

**ملاحظة تنسيق البطاقات:**
- سيتم إعادة استخدام السجلات القائمة عبر UPDATE فقط، بحيث اشتراكات المستخدمين النشطة في `user_cards` تبقى صالحة تلقائياً (لأن `card_id` FK لن يتغير).

**عدم لمس:**
- منطق الاشتراك في PriceProtection والخطط الأخرى (target_type='protection_plan') يبقى كما هو.
- بطاقة `is_system_reserved` (الليفو الفيزيائية) لا علاقة لها بالخطط الرقمية — لا تُمَس.
