# خطة: نظام بطاقة ليفو الجديد

استبدال نظام "أكواد التفعيل" الحالي بنظام بطاقة فيزيائية موحّدة مع اشتراك شهري مستقل، ودعم إدخال عبر NFC/QR/الرقم اليدوي، وإدارة كاملة للاشتراكات مع ترقية prorated.

## القرارات المُثبَّتة من الأسئلة

- **رقم موحّد**: 16 رقم واحد يظهر مطبوعاً + مُشفَّر داخل QR + NFC (توكن سري منفصل).
- **دفعتان منفصلتان**: البطاقة الفيزيائية = منتج بسعر مستقل. الاشتراك = خدمة شهرية بسعرها.
- **الحذف**: إلغاء الاشتراك مع الاحتفاظ بالايام المتبقيه + تحرير البطاقة لتفعيلها على حساب آخر.
- **الترحيل**: حذف كامل لجدول `loyalty_card_codes` القديم + كل بطاقات المستخدمين الحالية من ذلك النظام (بداية جديدة).

## واجهة المستخدم — `/rewards` → بطاقاتي

### 1) استبدال "تفعيل بطاقة بكود"

- إعادة تسمية إلى: **"تفعيل بطاقة ليفو"** (ar/en/ku).
- شاشة موحّدة بثلاث طرق إدخال:
  - **الرقم اليدوي**: 16 خانة رقمية (تنسيق تلقائي `1234-5678-9012-3456`).
  - **مسح QR**: زر يفتح كاميرا الهاتف عبر `html5-qrcode` (مستخدَم فعلاً في المشروع للضمان).
  - **NFC**: زر "قرّب بطاقتك" يستخدم Web NFC API (`NDEFReader` — Chrome Android)؛ في الأجهزة غير المدعومة يخفى الزر مع تلميح.
- إزالة شرط "طابعة فعّالة" من UI ومن الـ RPC.

### 2) قسم "بطاقتي" (عندما توجد بطاقة نشطة)

- رقم البطاقة المخفي (`•••• •••• •••• 3456`) + زر كشف.
- الاشتراك الحالي (اسم البطاقة، تاريخ البدء، الأيام المتبقية).
- زر **"ترقية"** ← يفتح لوحة بطاقات أعلى فقط، مع عرض السعر بعد خصم رصيد الأيام (prorated).
- زر **"حذف البطاقة"** (تأكيد بحوار: يوضّح أن الاشتراك سيبقى يستهلك مع الايام وأن البطاقة ستتحرر).

### 3) عندما لا توجد بطاقة

- زر بارز **"اطلب بطاقة ليفو"** ← يضيف البطاقة الفيزيائية إلى السلة كمنتج عادي (شحن للمنزل).

## قاعدة البيانات — Migration واحد

### حذف

- `DROP TABLE loyalty_card_codes CASCADE` (وحذف الـ RPC القديمة `redeem_loyalty_card_code` إن وُجدت).
- `DELETE FROM user_cards WHERE ...` (كل السجلات الناتجة عن النظام القديم — بداية نظيفة).

### جداول جديدة

`**levo_physical_cards**` (مخزون البطاقات الفيزيائية التي أنشأها الأدمن):

- `card_number` TEXT UNIQUE (16 خانة).
- `card_number_hash` TEXT (bcrypt/sha256 مفهرس — للبحث الآمن).
- `batch_label` TEXT، `status` (unassigned/assigned/revoked)، `created_by`، `notes`.

`**levo_card_assignments**` (ربط بطاقة ← مستخدم واحد فقط في وقت واحد):

- `card_id` FK فريد جزئياً `WHERE released_at IS NULL` (بطاقة واحدة نشطة على مستخدم واحد).
- `user_id` FK، `assigned_at`، `released_at` (لسجل التاريخ عند الحذف/النقل).

`**levo_card_subscriptions**`:

- `assignment_id` FK فريد جزئياً `WHERE status='active'` (اشتراك نشط واحد فقط لكل بطاقة).
- `membership_card_id` FK → `membership_cards` (نوع الاشتراك: كلاسيك/بلس/برو…).
- `started_at`، `expires_at`، `status` (active/expired/cancelled/upgraded).
- `paid_amount` NUMERIC، `payment_method` TEXT، `source_order_id` UUID (اختياري).

`**levo_card_subscription_history**` (لسجل الترقيات مع تفصيل prorated):

- `subscription_id`، `previous_plan_id`، `new_plan_id`، `days_used`، `days_remaining`، `credit_applied`، `difference_paid`، `created_at`.

كل الجداول تشمل GRANT صحيحة + RLS (المستخدم يرى/يلغي بطاقته فقط؛ الأدمن كامل الصلاحيات؛ خدمة تستخدم `service_role`).

### تعديل على `membership_cards`

- إضافة `physical_card_product_id` UUID (اختياري) على مستوى global settings (أو صف واحد في `default_settings`) ← يشير إلى المنتج الذي يمثّل البطاقة الفيزيائية في المتجر.

### RPCs جديدة (SECURITY DEFINER)

- `levo_activate_card(p_card_number TEXT)` — يبحث بالـ hash، يتحقق أن `assignments` فارغة، يربطها بالمستخدم. لا يفعّل أي اشتراك.
- `levo_release_card(p_assignment_id UUID)` — يضع `released_at=now()`، ويضبط الاشتراك النشط `status='cancelled'` بلا استرداد.
- `levo_subscribe_card(p_assignment_id, p_membership_card_id, p_payment_method, p_amount)` — ينشئ اشتراكاً جديداً بشرط عدم وجود واحد نشط.
- `levo_upgrade_subscription(p_assignment_id, p_new_membership_card_id, p_payment_method)` — يحسب `days_used`، credit = `(paid_amount / duration_days) * days_remaining`، السعر النهائي = `new_plan.wallet_price - credit`. يرفض التنزيل (`new_plan.display_order <= current.display_order`). يوسم القديم `upgraded` وينشئ جديداً بمدة كاملة من الآن، مع سجل في `history`.
- `admin_generate_levo_cards(p_count, p_batch_label)` — يولّد 16 رقم عشوائي فريد لكل بطاقة (Luhn-like optional) بلا ربط بمستخدم.
- `admin_get_card_owner(p_card_number)` — يعيد معلومات المستخدم + الاشتراك الحالي للأدمن.
- `admin_assign_subscription`، `admin_release_card`، `admin_delete_card`.

## لوحة الأدمن

### استبدال `AdminLoyaltyCardCodes` بـ `AdminLevoCards`

- **إنشاء دُفعة**: اختيار العدد + label ← يولّد بطاقات 16 رقم قابلة للطباعة/التصدير CSV مع QR (`qrcode.react`) للطباعة الفيزيائية.
- **إدارة بطاقة**:
  - بحث بالرقم أو اسم المستخدم.
  - عرض معلومات المالك (اسم/username/avatar/تاريخ التفعيل).
  - جدول الاشتراكات (سابقة/حالية) مع الأيام المتبقية.
  - أزرار: تفعيل اشتراك (اختيار نوع + مدة)، فك البطاقة من المستخدم، حذف البطاقة نهائياً، إلغاء اشتراك.
- **حذف** `AdminLoyaltyCodeRedemptions` (يُدمج داخل صفحة إدارة البطاقة).

## المتجر — طلب بطاقة ليفو

- المنتج الفيزيائي موجود عبر `products` كأي منتج (يضعه الأدمن مرة). إعداد `default_settings.levo_physical_card_product_id` يشير له.
- الكوبونات: إضافة عمود `applies_to_levo_card_only` BOOLEAN على `coupons`. عند التحقق يُطبّق فقط إذا كانت السلة تحتوي هذا المنتج بالضبط (وعكسياً: كوبونات عادية لا تعمل عليه إن كان العلم مفعّلاً).
- بعد وصول الطلب وتسليمه، يبقى إدخال الرقم يدوياً/QR/NFC من قبل المستخدم لتفعيل ملكية البطاقة.

## دفع الاشتراك والترقية

- الترقية تُخصم من المحفظة أو COD (نفس آليات الاشتراكات الحالية في `printer_subscriptions`).
- إعادة استخدام `subscription_payments` بإضافة نوع `payment_type='levo_card'` مع ربط `subscription_id` بجدول `levo_card_subscriptions`.

## اختبار السيناريوهات (ملف Vitest جديد `levoCard.test.ts`)

1. تفعيل ببطاقة صحيحة → نجاح.
2. تفعيل بنفس البطاقة من مستخدم ثانٍ → رفض حتى الحذف من الأول.
3. حذف من الأول ثم تفعيل من ثانٍ → نجاح.
4. اشتراك ليفو بلس ثم ترقية بعد 15 يوم إلى برو (45k → 90k مثلاً) → credit=22,500 و difference=67,500.
5. محاولة تنزيل من برو إلى بلس → رفض.
6. حذف البطاقة أثناء اشتراك نشط → status=cancelled الاشتراك يبقى  + بطاقة متاحة للتفعيل مجدداً.
7. إدخال رقم غير موجود → خطأ واضح.
8. كوبون `applies_to_levo_card_only` على منتج عادي → رفض.

## تفاصيل تقنية

- Web NFC: `if ('NDEFReader' in window)` قبل عرض الزر؛ عدم كسر iOS.
- Hash الرقم: `pgcrypto crypt(...)` مع salt ثابت لجدول للبحث السريع، أو عمود `card_number_last4` لعرض `••••3456`.
- كل RPCs `SECURITY DEFINER` مع `SET search_path=public` وتحقق من `auth.uid()`.
- Realtime على `levo_card_assignments` و `levo_card_subscriptions` لتحديث UI فوراً.
- i18n لكل النصوص الجديدة في `ar/en/ku`.

## الملفات المتأثرة تقريباً

- **جديد**: migration، `LevoCardActivator.tsx`، `LevoCardManager.tsx`، `LevoNfcButton.tsx`، `LevoQrScanner.tsx`، `AdminLevoCards.tsx`، `AdminLevoCardDetail.tsx`، `levoCard.test.ts`.
- **تعديل**: `CardsSection.tsx` (إزالة `RedeemLoyaltyCodeCard` واستبداله)، `App.tsx` (route جديد للأدمن)، `i18n/*`، `types.ts` (auto)، `coupons` validation logic في السلة.
- **حذف**: `RedeemLoyaltyCodeCard.tsx`، `LoyaltyCodeHistoryCard.tsx`، `AdminLoyaltyCardCodes.tsx`، `AdminLoyaltyCodeRedemptions.tsx`، جدول `loyalty_card_codes` وكل RPCs المرتبطة.